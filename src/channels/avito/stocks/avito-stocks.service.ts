import { Injectable } from '@nestjs/common';

import type {
  ChannelStockInfo,
  StockPort,
} from '../../contracts/channel-adapter.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import type { StockQuantity } from '../../contracts/models.js';
import {
  AVITO_ENDPOINTS,
  AVITO_RATE_LIMITS,
  AVITO_STOCKS_BATCH_SIZE,
  AVITO_STOCKS_INFO_BATCH_SIZE,
} from '../avito.constants.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type {
  AvitoStocksInfoRequest,
  AvitoStocksInfoResponse,
  AvitoStocksRequest,
  AvitoStocksResponse,
} from '../client/avito-api.types.js';

@Injectable()
export class AvitoStocksService implements StockPort {
  constructor(private readonly api: AvitoApiClient) {}

  async pushStocks(ctx: ChannelContext, items: StockQuantity[]): Promise<void> {
    if (items.length === 0) {
      return;
    }

    for (let offset = 0; offset < items.length; offset += AVITO_STOCKS_BATCH_SIZE) {
      const batch = items.slice(offset, offset + AVITO_STOCKS_BATCH_SIZE);
      const body: AvitoStocksRequest = {
        stocks: batch.map((item) => ({
          item_id: Number(item.externalId),
          quantity: item.quantity,
        })),
      };

      const response = await this.api.request<AvitoStocksResponse>(ctx, {
        method: 'PUT',
        path: AVITO_ENDPOINTS.stocks,
        endpoint: AVITO_ENDPOINTS.stocks,
        json: body,
        rateLimitPerMinute: AVITO_RATE_LIMITS.stocks,
      });

      const failed = (response.stocks ?? []).filter((row) => row.success === false);
      if (failed.length > 0) {
        const details = failed
          .map((row) => `${row.item_id}: ${(row.errors ?? []).join('; ') || 'ошибка'}`)
          .join(' | ');
        throw new Error(`Авито отклонила часть остатков: ${details}`);
      }
    }
  }

  async fetchStocks(
    ctx: ChannelContext,
    externalIds: string[],
  ): Promise<ChannelStockInfo[]> {
    if (externalIds.length === 0) {
      return [];
    }

    const result: ChannelStockInfo[] = [];

    for (let offset = 0; offset < externalIds.length; offset += AVITO_STOCKS_INFO_BATCH_SIZE) {
      const batch = externalIds.slice(offset, offset + AVITO_STOCKS_INFO_BATCH_SIZE);
      const itemIds = batch
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && id > 0);

      if (itemIds.length === 0) {
        continue;
      }

      const body: AvitoStocksInfoRequest = {
        item_ids: itemIds,
        strong_consistency: true,
      };

      const response = await this.api.request<AvitoStocksInfoResponse>(ctx, {
        method: 'POST',
        path: AVITO_ENDPOINTS.stocksInfo,
        endpoint: AVITO_ENDPOINTS.stocksInfo,
        json: body,
        rateLimitPerMinute: AVITO_RATE_LIMITS.stocks,
      });

      for (const row of response.stocks ?? []) {
        result.push({
          externalId: String(row.item_id),
          quantity: Number(row.quantity) || 0,
          isUnlimited: Boolean(row.is_unlimited),
          isMultiple: Boolean(row.is_multiple),
          isOutOfStock: Boolean(row.is_out_of_stock),
        });
      }
    }

    return result;
  }
}
