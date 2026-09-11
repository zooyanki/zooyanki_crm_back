import { Injectable, Logger } from '@nestjs/common';

import { ChannelRegistry } from '../channels/channel.registry.js';
import { Capability } from '../channels/contracts/channel-adapter.js';
import type { ChannelContext } from '../channels/contracts/channel-context.js';
import { PrismaService } from '../core/db/prisma.service.js';
import type { ChannelCode } from '../generated/prisma/enums.js';

const SYNC_ENTITY = 'stats';

export interface StatsSyncResult {
  points: number;
}

@Injectable()
export class StatsSyncService {
  private readonly logger = new Logger(StatsSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ChannelRegistry,
  ) {}

  async syncAccount(
    ctx: ChannelContext,
    channel: ChannelCode,
    from: Date,
    to: Date,
  ): Promise<StatsSyncResult> {
    const adapter = this.registry.get(channel);

    if (!adapter.stats || !adapter.capabilities.has(Capability.READ_STATS)) {
      this.logger.warn(`Площадка ${channel} не отдаёт статистику, синхронизация пропущена`);
      return { points: 0 };
    }

    const listings = await this.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.channelListing.findMany({
        where: { channelAccountId: ctx.channelAccountId },
        select: { id: true, externalId: true, variantId: true },
      }),
    );

    if (listings.length === 0) {
      return { points: 0 };
    }

    const byExternalId = new Map(listings.map((row) => [row.externalId, row]));

    const points = await adapter.stats.fetchDailyStats(ctx, {
      externalIds: listings.map((row) => row.externalId),
      from,
      to,
    });

    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      for (const point of points) {
        const listing = byExternalId.get(point.externalId);

        // Метрика по объявлению, которого нет в нашей базе, означает,
        // что список публикаций устарел. Ждём следующей синхронизации.
        if (!listing) {
          continue;
        }

        const values = {
          views: point.views,
          contacts: point.contacts,
          favorites: point.favorites,
        };

        await tx.statsDaily.upsert({
          where: {
            channelAccountId_listingId_date: {
              channelAccountId: ctx.channelAccountId,
              listingId: listing.id,
              date: point.date,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            channelAccountId: ctx.channelAccountId,
            listingId: listing.id,
            variantId: listing.variantId,
            date: point.date,
            ...values,
          },
          update: values,
        });
      }

      await tx.syncState.upsert({
        where: {
          channelAccountId_entity: { channelAccountId: ctx.channelAccountId, entity: SYNC_ENTITY },
        },
        create: {
          tenantId: ctx.tenantId,
          channelAccountId: ctx.channelAccountId,
          entity: SYNC_ENTITY,
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
        },
        update: { lastRunAt: new Date(), lastSuccessAt: new Date(), lastError: null },
      });
    });

    this.logger.log(`Сохранено ${points.length} точек статистики ${channel}`);

    return { points: points.length };
  }
}
