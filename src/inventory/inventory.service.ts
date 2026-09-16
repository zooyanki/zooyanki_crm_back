import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client.js';
import type { ChannelCode } from '../generated/prisma/enums.js';
import { StockMovementType } from '../generated/prisma/enums.js';
import { PrismaService, type TransactionClient } from '../core/db/prisma.service.js';
import { OutboxService } from '../core/outbox/outbox.service.js';
import { OUTBOX_TYPES, type StocksPushPayload } from '../core/outbox/outbox.types.js';

export interface InventoryView {
  id: string;
  variantId: string;
  sku: string;
  title: string | null;
  quantity: number;
  reserved: number;
  available: number;
  listingId: string | null;
  listingExternalId: string | null;
  channel: ChannelCode | null;
  channelAccountId: string | null;
  updatedAt: Date;
}

export interface InventoryListResult {
  items: InventoryView[];
  total: number;
  page: number;
  perPage: number;
}

export interface AdjustInventoryInput {
  listingId: string;
  quantity: number;
  reason?: string;
  pushToChannel?: boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    tenantId: string,
    page: number,
    perPage: number,
  ): Promise<InventoryListResult> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.InventoryItemWhereInput = {
        variant: {
          listings: {
            some: { status: 'ACTIVE' },
          },
        },
      };

      const [rows, total] = await Promise.all([
        tx.inventoryItem.findMany({
          where,
          include: {
            variant: {
              include: {
                listings: {
                  where: { status: 'ACTIVE' },
                  include: { channelAccount: { select: { channel: true } } },
                  orderBy: { updatedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * perPage,
          take: perPage,
        }),
        tx.inventoryItem.count({ where }),
      ]);

      return {
        items: rows.map((row) => this.toView(row)),
        total,
        page,
        perPage,
      };
    });
  }

  async getByListingId(
    tenantId: string,
    listingId: string,
  ): Promise<InventoryView | null> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const listing = await tx.channelListing.findUnique({
        where: { id: listingId },
        select: { variantId: true },
      });

      if (!listing?.variantId) {
        return null;
      }

      const row = await tx.inventoryItem.findUnique({
        where: {
          tenantId_variantId: { tenantId, variantId: listing.variantId },
        },
        include: {
          variant: {
            include: {
              listings: {
                include: { channelAccount: { select: { channel: true } } },
                orderBy: { updatedAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      return row ? this.toView(row) : null;
    });
  }

  private toView(row: {
    id: string;
    variantId: string;
    quantity: number;
    reserved: number;
    updatedAt: Date;
    variant: {
      sku: string;
      title: string | null;
      listings: Array<{
        id: string;
        externalId: string;
        title: string | null;
        channelAccountId: string;
        channelAccount: { channel: ChannelCode };
      }>;
    };
  }): InventoryView {
    const listing = row.variant.listings[0] ?? null;
    return {
      id: row.id,
      variantId: row.variantId,
      sku: row.variant.sku,
      title: row.variant.title ?? listing?.title ?? null,
      quantity: row.quantity,
      reserved: row.reserved,
      available: Math.max(0, row.quantity - row.reserved),
      listingId: listing?.id ?? null,
      listingExternalId: listing?.externalId ?? null,
      channel: listing?.channelAccount.channel ?? null,
      channelAccountId: listing?.channelAccountId ?? null,
      updatedAt: row.updatedAt,
    };
  }

  /// Устанавливает абсолютный остаток по объявлению. Если у листинга ещё
  /// нет варианта каталога — создаём Product+Variant и связываем.
  async adjust(tenantId: string, input: AdjustInventoryInput): Promise<InventoryView> {
    if (!Number.isInteger(input.quantity) || input.quantity < 0) {
      throw new BadRequestException('quantity должен быть целым числом ≥ 0');
    }

    const pushToChannel = input.pushToChannel !== false;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const listing = await tx.channelListing.findUnique({
        where: { id: input.listingId },
        include: { channelAccount: { select: { channel: true } } },
      });

      if (!listing) {
        throw new NotFoundException(`Объявление ${input.listingId} не найдено`);
      }

      const variantId = listing.variantId ?? (await this.ensureVariant(tx, tenantId, listing));

      if (!listing.variantId) {
        await tx.channelListing.update({
          where: { id: listing.id },
          data: { variantId },
        });
      }

      const existing = await tx.inventoryItem.findUnique({
        where: {
          tenantId_variantId: { tenantId, variantId },
        },
      });

      const previous = existing?.quantity ?? 0;
      const delta = input.quantity - previous;
      const reserved = existing?.reserved ?? 0;

      if (input.quantity < reserved) {
        throw new BadRequestException(
          `Нельзя поставить ${input.quantity}: зарезервировано ${reserved}`,
        );
      }

      const item = await tx.inventoryItem.upsert({
        where: {
          tenantId_variantId: { tenantId, variantId },
        },
        create: {
          tenantId,
          variantId,
          quantity: input.quantity,
          reserved: 0,
        },
        update: {
          quantity: input.quantity,
        },
        include: {
          variant: true,
        },
      });

      if (delta !== 0) {
        await tx.stockMovement.create({
          data: {
            tenantId,
            variantId,
            type: StockMovementType.ADJUSTMENT,
            quantity: delta,
            reason: input.reason ?? 'Ручная корректировка',
            meta: { listingId: listing.id, absolute: input.quantity },
          },
        });
      }

      const available = Math.max(0, item.quantity - item.reserved);

      if (pushToChannel) {
        const payload = {
          items: [{ externalId: listing.externalId, quantity: available }],
        } satisfies StocksPushPayload;

        await this.outbox.enqueueInTx(tx, {
          tenantId,
          channelAccountId: listing.channelAccountId,
          type: OUTBOX_TYPES.STOCKS_PUSH,
          payload: payload as Prisma.InputJsonValue,
          idempotencyKey: `stocks:${listing.id}:${item.updatedAt.toISOString()}:${available}`,
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            variantId,
            type: StockMovementType.CHANNEL_PUSH,
            quantity: available,
            reason: 'Постановка публикации остатка в outbox',
            meta: {
              listingId: listing.id,
              channelAccountId: listing.channelAccountId,
              externalId: listing.externalId,
            },
          },
        });
      }

      return {
        id: item.id,
        variantId: item.variantId,
        sku: item.variant.sku,
        title: item.variant.title ?? listing.title,
        quantity: item.quantity,
        reserved: item.reserved,
        available,
        listingId: listing.id,
        listingExternalId: listing.externalId,
        channel: listing.channelAccount.channel,
        channelAccountId: listing.channelAccountId,
        updatedAt: item.updatedAt,
      };
    });
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
}
