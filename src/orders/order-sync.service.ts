import { Injectable, Logger } from '@nestjs/common';

import { ChannelRegistry } from '../channels/channel.registry.js';
import { Capability } from '../channels/contracts/channel-adapter.js';
import type { ChannelContext } from '../channels/contracts/channel-context.js';
import type { CanonicalOrder } from '../channels/contracts/models.js';
import { PrismaService } from '../core/db/prisma.service.js';
import type { ChannelCode } from '../generated/prisma/enums.js';

const SYNC_ENTITY = 'orders';
const MAX_PAGES = 200;

export interface OrderSyncResult {
  fetched: number;
  pages: number;
}

@Injectable()
export class OrderSyncService {
  private readonly logger = new Logger(OrderSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ChannelRegistry,
  ) {}

  async syncAccount(ctx: ChannelContext, channel: ChannelCode): Promise<OrderSyncResult> {
    const adapter = this.registry.get(channel);

    if (!adapter.orders || !adapter.capabilities.has(Capability.READ_ORDERS)) {
      this.logger.warn(`Площадка ${channel} не умеет читать заказы, синхронизация пропущена`);
      return { fetched: 0, pages: 0 };
    }

    let page = 1;
    let fetched = 0;
    let pages = 0;

    try {
      for (;;) {
        const batch = await adapter.orders.fetchOrders(ctx, page);
        await this.upsertOrders(ctx, channel, batch.items);

        fetched += batch.items.length;
        pages += 1;

        if (!batch.hasMore || batch.nextPage === null || pages >= MAX_PAGES) {
          break;
        }

        page = batch.nextPage;
      }

      await this.recordSuccess(ctx);
      this.logger.log(`Импортировано ${fetched} заказов (${pages} стр.) из ${channel}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.recordFailure(ctx, message);
      throw error;
    }

    return { fetched, pages };
  }

  private async upsertOrders(
    ctx: ChannelContext,
    channel: ChannelCode,
    orders: CanonicalOrder[],
  ): Promise<void> {
    if (orders.length === 0) {
      return;
    }

    const syncedAt = new Date();

    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      for (const order of orders) {
        const saved = await tx.order.upsert({
          where: {
            channelAccountId_externalId: {
              channelAccountId: ctx.channelAccountId,
              externalId: order.externalId,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            channelAccountId: ctx.channelAccountId,
            channel,
            externalId: order.externalId,
            marketplaceId: order.marketplaceId,
            status: order.status,
            rawStatus: order.rawStatus,
            availableActions: order.availableActions as object | undefined,
            totalAmount: order.totalAmount,
            commissionAmount: order.commissionAmount,
            deliveryAmount: order.deliveryAmount,
            discountAmount: order.discountAmount,
            currency: order.currency,
            deliveryJson: order.delivery as object | undefined,
            schedulesJson: order.schedules as object | undefined,
            placedAt: order.placedAt,
            syncedAt,
          },
          update: {
            marketplaceId: order.marketplaceId,
            status: order.status,
            rawStatus: order.rawStatus,
            availableActions: order.availableActions as object | undefined,
            totalAmount: order.totalAmount,
            commissionAmount: order.commissionAmount,
            deliveryAmount: order.deliveryAmount,
            discountAmount: order.discountAmount,
            currency: order.currency,
            deliveryJson: order.delivery as object | undefined,
            schedulesJson: order.schedules as object | undefined,
            placedAt: order.placedAt,
            syncedAt,
          },
        });

        await tx.orderItem.deleteMany({ where: { orderId: saved.id } });

        if (order.items.length > 0) {
          // Сопоставляем позицию с нашей публикацией по avitoId.
          const avitoIds = order.items
            .map((item) => item.avitoId)
            .filter((id): id is string => Boolean(id));

          const listings =
            avitoIds.length === 0
              ? []
              : await tx.channelListing.findMany({
                  where: {
                    channelAccountId: ctx.channelAccountId,
                    externalId: { in: avitoIds },
                  },
                  select: { id: true, externalId: true, variantId: true },
                });

          const listingByAvitoId = new Map(listings.map((row) => [row.externalId, row]));

          await tx.orderItem.createMany({
            data: order.items.map((item) => {
              const listing = item.avitoId ? listingByAvitoId.get(item.avitoId) : undefined;
              return {
                tenantId: ctx.tenantId,
                orderId: saved.id,
                variantId: listing?.variantId ?? null,
                listingId: listing?.id ?? null,
                externalId: item.externalId,
                avitoId: item.avitoId,
                title: item.title,
                quantity: item.quantity,
                price: item.price,
                total: item.total,
                currency: item.currency,
              };
            }),
          });
        }
      }
    });
  }

  private async recordSuccess(ctx: ChannelContext): Promise<void> {
    const now = new Date();
    await this.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.syncState.upsert({
        where: {
          channelAccountId_entity: { channelAccountId: ctx.channelAccountId, entity: SYNC_ENTITY },
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
  }

  private async recordFailure(ctx: ChannelContext, message: string): Promise<void> {
    const now = new Date();
    await this.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.syncState.upsert({
        where: {
          channelAccountId_entity: { channelAccountId: ctx.channelAccountId, entity: SYNC_ENTITY },
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
