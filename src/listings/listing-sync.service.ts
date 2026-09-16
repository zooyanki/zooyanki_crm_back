import { Injectable, Logger } from '@nestjs/common';

import { ChannelRegistry } from '../channels/channel.registry.js';
import { Capability } from '../channels/contracts/channel-adapter.js';
import type { ChannelContext } from '../channels/contracts/channel-context.js';
import type { CanonicalListing } from '../channels/contracts/models.js';
import { PrismaService, type TransactionClient } from '../core/db/prisma.service.js';
import { ensureVariantForListing } from '../catalog/catalog.service.js';
import type { ChannelCode } from '../generated/prisma/enums.js';

const SYNC_ENTITY = 'listings';
/// Защита от бесконечного обхода, если площадка отдаёт некорректную
/// информацию о количестве страниц.
const MAX_PAGES = 500;

export interface ListingSyncResult {
  fetched: number;
  pages: number;
}

@Injectable()
export class ListingSyncService {
  private readonly logger = new Logger(ListingSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ChannelRegistry,
  ) {}

  async syncAccount(
    ctx: ChannelContext,
    channel: ChannelCode,
  ): Promise<ListingSyncResult> {
    const adapter = this.registry.get(channel);

    if (!adapter.listings || !adapter.capabilities.has(Capability.READ_LISTINGS)) {
      this.logger.warn(`Площадка ${channel} не умеет читать объявления, синхронизация пропущена`);
      return { fetched: 0, pages: 0 };
    }

    let cursor: string | null = null;
    let fetched = 0;
    let pages = 0;

    try {
      do {
        const page = await adapter.listings.fetchListings(ctx, cursor);
        await this.upsertPage(ctx, channel, page.items);

        fetched += page.items.length;
        pages += 1;
        cursor = page.nextCursor;
      } while (cursor !== null && pages < MAX_PAGES);

      await this.recordSuccess(ctx);
      this.logger.log(`Импортировано ${fetched} объявлений (${pages} стр.) из ${channel}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.recordFailure(ctx, message);
      throw error;
    }

    return { fetched, pages };
  }

  private async upsertPage(
    ctx: ChannelContext,
    channel: ChannelCode,
    items: CanonicalListing[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const syncedAt = new Date();

    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      for (const item of items) {
        const common = {
          title: item.title,
          url: item.url,
          price: item.price,
          currency: item.currency,
          categoryId: item.categoryId,
          status: item.status,
          rawStatus: item.rawStatus,
          publishedAt: item.publishedAt,
          syncedAt,
        };

        const listing = await tx.channelListing.upsert({
          where: {
            channelAccountId_externalId: {
              channelAccountId: ctx.channelAccountId,
              externalId: item.externalId,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            channelAccountId: ctx.channelAccountId,
            externalId: item.externalId,
            ...common,
          },
          update: common,
        });

        if (!listing.variantId) {
          const variantId = await ensureVariantForListing(tx as TransactionClient, ctx.tenantId, {
            id: listing.id,
            externalId: listing.externalId,
            title: listing.title,
            price: listing.price,
            currency: listing.currency,
            channelAccount: { channel },
          });
          await tx.channelListing.update({
            where: { id: listing.id },
            data: { variantId },
          });
        }
      }
    });
  }

  private async recordSuccess(ctx: ChannelContext): Promise<void> {
    const now = new Date();

    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      await tx.syncState.upsert({
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
      });

      await tx.channelAccount.update({
        where: { id: ctx.channelAccountId },
        data: { lastSyncAt: now },
      });
    });
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
