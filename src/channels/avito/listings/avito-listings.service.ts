import { Injectable } from '@nestjs/common';

import type { ChannelContext } from '../../contracts/channel-context.js';
import type { ListingReader } from '../../contracts/channel-adapter.js';
import type { ListingPage } from '../../contracts/models.js';
import { AVITO_ENDPOINTS, AVITO_ITEMS_PAGE_SIZE, AVITO_RATE_LIMITS } from '../avito.constants.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type { AvitoItemsResponse } from '../client/avito-api.types.js';
import { toCanonicalListing } from '../mappers/listing.mapper.js';

@Injectable()
export class AvitoListingsService implements ListingReader {
  constructor(private readonly api: AvitoApiClient) {}

  /// Курсор — номер страницы в виде строки. Для Авито этого достаточно:
  /// метод отдаёт meta.pages, по которому видно, когда остановиться.
  async fetchListings(ctx: ChannelContext, cursor: string | null): Promise<ListingPage> {
    const page = cursor ? Number(cursor) : 1;

    const response = await this.api.request<AvitoItemsResponse>(ctx, {
      method: 'GET',
      path: AVITO_ENDPOINTS.items,
      endpoint: AVITO_ENDPOINTS.items,
      query: { page, per_page: AVITO_ITEMS_PAGE_SIZE },
      rateLimitPerMinute: AVITO_RATE_LIMITS.items,
    });

    const hasMore = page < response.meta.pages;

    return {
      items: response.resources.map(toCanonicalListing),
      nextCursor: hasMore ? String(page + 1) : null,
    };
  }
}
