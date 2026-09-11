import { Injectable } from '@nestjs/common';

import type { ChannelContext } from '../../contracts/channel-context.js';
import type { ListingReader } from '../../contracts/channel-adapter.js';
import type { ListingPage } from '../../contracts/models.js';
import {
  AVITO_ENDPOINTS,
  AVITO_ITEM_STATUSES,
  AVITO_ITEMS_PAGE_SIZE,
  AVITO_RATE_LIMITS,
} from '../avito.constants.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type { AvitoItemsResponse } from '../client/avito-api.types.js';
import { toCanonicalListing } from '../mappers/listing.mapper.js';

@Injectable()
export class AvitoListingsService implements ListingReader {
  constructor(private readonly api: AvitoApiClient) {}

  /// Курсор — номер страницы в виде строки.
  ///
  /// Общего числа страниц Авито не сообщает, поэтому признак конца списка —
  /// неполная страница. Если последняя страница окажется ровно полной,
  /// будет один лишний пустой запрос: это дешевле, чем недобрать объявления.
  async fetchListings(ctx: ChannelContext, cursor: string | null): Promise<ListingPage> {
    const page = cursor ? Number(cursor) : 1;

    const response = await this.api.request<AvitoItemsResponse>(ctx, {
      method: 'GET',
      path: AVITO_ENDPOINTS.items,
      endpoint: AVITO_ENDPOINTS.items,
      query: {
        page,
        per_page: AVITO_ITEMS_PAGE_SIZE,
        status: AVITO_ITEM_STATUSES,
      },
      rateLimitPerMinute: AVITO_RATE_LIMITS.items,
    });

    const hasMore = response.resources.length === AVITO_ITEMS_PAGE_SIZE;

    return {
      items: response.resources.map(toCanonicalListing),
      nextCursor: hasMore ? String(page + 1) : null,
    };
  }
}
