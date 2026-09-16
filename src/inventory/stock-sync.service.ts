import { Injectable, Logger } from '@nestjs/common';

import { ChannelRegistry } from '../channels/channel.registry.js';
import {
  Capability,
  type ChannelStockInfo,
} from '../channels/contracts/channel-adapter.js';
import type { ChannelContext } from '../channels/contracts/channel-context.js';
import { PrismaService, type TransactionClient } from '../core/db/prisma.service.js';
import { StockMovementType, type ChannelCode } from '../generated/prisma/enums.js';

const SYNC_ENTITY = 'stocks';

export interface StockSyncResult {
  listings: number;
  updated: number;
  unchanged: number;
}

@Injectable()
export class StockSyncService {
  private readonly logger = new Logger(StockSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ChannelRegistry,
  ) {}

  async syncAccount(ctx: ChannelContext, channel: ChannelCode): Promise<StockSyncResult> {
    const adapter = this.registry.get(channel);

    if (
      !adapter.stocks?.fetchStocks ||
      !adapter.capabilities.has(Capability.READ_STOCK)
    ) {
      this.logger.warn(`Площадка ${channel} не умеет читать остатки, синхронизация пропущена`);
      return { listings: 0, updated: 0, unchanged: 0 };
    }

    try {
      const listings = await this.prisma.withTenant(ctx.tenantId, (tx) =>
        tx.channelListing.findMany({
          where: { channelAccountId: ctx.channelAccountId },
          select: {
            id: true,
            externalId: true,
            variantId: true,
            title: true,
            price: true,
            currency: true,
          },
        }),
      );

      if (listings.length === 0) {
        await this.recordSuccess(ctx);
        return { listings: 0, updated: 0, unchanged: 0 };
      }

      const stocks = await adapter.stocks.fetchStocks(
        ctx,
        listings.map((row) => row.externalId),
      );
      const byExternalId = new Map(stocks.map((row) => [row.externalId, row]));

      let updated = 0;
      let unchanged = 0;

      await this.prisma.withTenant(ctx.tenantId, async (tx) => {
        for (const listing of listings) {
          const stock = byExternalId.get(listing.externalId);
          if (!stock) {
            continue;
          }

          const changed = await this.upsertFromChannel(tx, ctx.tenantId, listing, stock);
          if (changed) {
            updated += 1;
          } else {
            unchanged += 1;
          }
        }
      });

      await this.recordSuccess(ctx);
      this.logger.log(
        `Остатки ${channel}: объявлений ${listings.length}, обновлено ${updated}, без изменений ${unchanged}`,
      );

      return { listings: listings.length, updated, unchanged };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.recordFailure(ctx, message);
      throw error;
    }
  }

  private async upsertFromChannel(
    tx: TransactionClient,
    tenantId: string,
    listing: {
      id: string;
      externalId: string;
      variantId: string | null;
      title: string | null;
      price: unknown;
      currency: string;
    },
    stock: ChannelStockInfo,
  ): Promise<boolean> {
    const variantId =
      listing.variantId ?? (await this.ensureVariant(tx, tenantId, listing));

    if (!listing.variantId) {
      await tx.channelListing.update({
        where: { id: listing.id },
        data: { variantId },
      });
    }

    const existing = await tx.inventoryItem.findUnique({
      where: { tenantId_variantId: { tenantId, variantId } },
    });

    const reserved = existing?.reserved ?? 0;
    /// quantity Авито — доступное; в CRM храним полный остаток = available + reserved.
    const nextQuantity = Math.max(0, stock.quantity + reserved);

    if (existing && existing.quantity === nextQuantity) {
      return false;
    }

    const delta = nextQuantity - (existing?.quantity ?? 0);

    await tx.inventoryItem.upsert({
      where: { tenantId_variantId: { tenantId, variantId } },
      create: {
        tenantId,
        variantId,
        quantity: nextQuantity,
        reserved: 0,
      },
      update: {
        quantity: nextQuantity,
      },
    });

    if (delta !== 0) {
      await tx.stockMovement.create({
        data: {
          tenantId,
          variantId,
          type: StockMovementType.ADJUSTMENT,
          quantity: delta,
          reason: 'Импорт остатка с площадки',
          meta: {
            listingId: listing.id,
            externalId: listing.externalId,
            channelAvailable: stock.quantity,
            isUnlimited: stock.isUnlimited,
            isOutOfStock: stock.isOutOfStock,
          },
        },
      });
    }

    return true;
  }

  private async ensureVariant(
    tx: TransactionClient,
    tenantId: string,
    listing: {
      id: string;
      externalId: string;
      title: string | null;
      price: unknown;
      currency: string;
    },
  ): Promise<string> {
    const sku = `avito-${listing.externalId}`;

    const existing = await tx.variant.findUnique({
      where: { tenantId_sku: { tenantId, sku } },
    });

    if (existing) {
      return existing.id;
    }

    const product = await tx.product.create({
      data: {
        tenantId,
        title: listing.title ?? `Объявление ${listing.externalId}`,
      },
    });

    const variant = await tx.variant.create({
      data: {
        tenantId,
        productId: product.id,
        sku,
        title: listing.title,
        price: listing.price as never,
        currency: listing.currency,
      },
    });

    return variant.id;
  }

  private async recordSuccess(ctx: ChannelContext): Promise<void> {
    const now = new Date();
    await this.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.syncState.upsert({
        where: {
          channelAccountId_entity: {
            channelAccountId: ctx.channelAccountId,
            entity: SYNC_ENTITY,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          channelAccountId: ctx.channelAccountId,
          entity: SYNC_ENTITY,
          lastRunAt: now,
          lastSuccessAt: now,
        },
        update: { lastRunAt: now, lastSuccessAt: now, lastError: null },
      }),
    );

    await this.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.channelAccount.update({
        where: { id: ctx.channelAccountId },
        data: { lastSyncAt: now },
      }),
    );
  }

  private async recordFailure(ctx: ChannelContext, message: string): Promise<void> {
    const now = new Date();
    await this.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.syncState.upsert({
        where: {
          channelAccountId_entity: {
            channelAccountId: ctx.channelAccountId,
            entity: SYNC_ENTITY,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          channelAccountId: ctx.channelAccountId,
          entity: SYNC_ENTITY,
          lastRunAt: now,
          lastError: message,
        },
        update: { lastRunAt: now, lastError: message },
      }),
    );
  }
}
