import { Injectable } from '@nestjs/common';

import type { StatsReader } from '../../contracts/channel-adapter.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import type { CanonicalStatsPoint, StatsQuery } from '../../contracts/models.js';
import { AVITO_ENDPOINTS, AVITO_RATE_LIMITS, AVITO_STATS_BATCH_SIZE } from '../avito.constants.js';
import { AvitoCredentialsService } from '../auth/avito-credentials.service.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type { AvitoStatsRequest, AvitoStatsResponse } from '../client/avito-api.types.js';

const STATS_FIELDS = ['uniqViews', 'uniqContacts', 'uniqFavorites'];

@Injectable()
export class AvitoStatsService implements StatsReader {
  constructor(
    private readonly api: AvitoApiClient,
    private readonly credentials: AvitoCredentialsService,
  ) {}

  async fetchDailyStats(ctx: ChannelContext, query: StatsQuery): Promise<CanonicalStatsPoint[]> {
    if (query.externalIds.length === 0) {
      return [];
    }

    const userId = await this.credentials.externalUserId(ctx);
    const path = AVITO_ENDPOINTS.itemStats.replace('{user_id}', userId);
    const points: CanonicalStatsPoint[] = [];

    // Метод принимает ограниченное число объявлений за раз, поэтому
    // разбиваем список на пачки.
    for (const batch of chunk(query.externalIds, AVITO_STATS_BATCH_SIZE)) {
      const body: AvitoStatsRequest = {
        dateFrom: toIsoDate(query.from),
        dateTo: toIsoDate(query.to),
        fields: STATS_FIELDS,
        itemIds: batch.map(Number),
        periodGrouping: 'day',
      };

      const response = await this.api.request<AvitoStatsResponse>(ctx, {
        method: 'POST',
        path,
        endpoint: AVITO_ENDPOINTS.itemStats,
        json: body,
        rateLimitPerMinute: AVITO_RATE_LIMITS.itemStats,
      });

      for (const item of response.result.items) {
        for (const stat of item.stats) {
          points.push({
            externalId: String(item.itemId),
            date: new Date(stat.date),
            views: stat.uniqViews ?? 0,
            contacts: stat.uniqContacts ?? 0,
            favorites: stat.uniqFavorites ?? 0,
          });
        }
      }
    }

    return points;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }

  return result;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
