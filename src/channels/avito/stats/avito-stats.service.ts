import { Injectable } from '@nestjs/common';

import type { StatsReader } from '../../contracts/channel-adapter.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import type {
  CanonicalSpendingPoint,
  CanonicalStatsPoint,
  StatsQuery,
} from '../../contracts/models.js';
import {
  AVITO_ENDPOINTS,
  AVITO_RATE_LIMITS,
  AVITO_STATS_BATCH_SIZE,
  AVITO_STATS_MAX_DAYS,
} from '../avito.constants.js';
import { AvitoCredentialsService } from '../auth/avito-credentials.service.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type {
  AvitoSpendingsRequest,
  AvitoSpendingsResponse,
  AvitoStatsRequest,
  AvitoStatsResponse,
} from '../client/avito-api.types.js';

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
    const from = clampRange(query.from, query.to);
    const points: CanonicalStatsPoint[] = [];

    for (const batch of chunk(query.externalIds, AVITO_STATS_BATCH_SIZE)) {
      const body: AvitoStatsRequest = {
        dateFrom: toIsoDate(from),
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
        rateLimitMaxWaitMs: 120_000,
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

  async fetchDailySpendings(
    ctx: ChannelContext,
    from: Date,
    to: Date,
  ): Promise<CanonicalSpendingPoint[]> {
    const userId = await this.credentials.externalUserId(ctx);
    const path = AVITO_ENDPOINTS.spendings.replace('{user_id}', userId);
    const body: AvitoSpendingsRequest = {
      dateFrom: toIsoDate(clampRange(from, to)),
      dateTo: toIsoDate(to),
      grouping: 'day',
      spendingTypes: ['all'],
    };

    const response = await this.api.request<AvitoSpendingsResponse>(ctx, {
      method: 'POST',
      path,
      endpoint: AVITO_ENDPOINTS.spendings,
      json: body,
      rateLimitPerMinute: AVITO_RATE_LIMITS.spendings,
      rateLimitMaxWaitMs: 120_000,
    });

    return (response.result.groupings ?? [])
      .filter((group) => Boolean(group.date))
      .map((group) => ({
        date: new Date(group.date!),
        spending: (group.spendings ?? []).reduce((sum, row) => sum + (row.value ?? 0), 0),
        currency: 'RUB',
      }));
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

function clampRange(from: Date, to: Date): Date {
  const earliest = new Date(to.getTime() - AVITO_STATS_MAX_DAYS * 86_400_000);
  return from < earliest ? earliest : from;
}
