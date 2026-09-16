import { Injectable } from '@nestjs/common';

import type {
  AutoloadIdLink,
  AutoloadProvider,
  AutoloadReportPage,
} from '../../contracts/channel-adapter.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import { AVITO_ENDPOINTS, AVITO_RATE_LIMITS } from '../avito.constants.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type {
  AvitoAutoloadAvitoIdsResponse,
  AvitoAutoloadLastReportResponse,
  AvitoAutoloadReportItemsResponse,
} from '../client/avito-api.types.js';

@Injectable()
export class AvitoAutoloadService implements AutoloadProvider {
  constructor(private readonly api: AvitoApiClient) {}

  async triggerUpload(ctx: ChannelContext): Promise<void> {
    await this.api.request<unknown>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.autoloadUpload,
      endpoint: AVITO_ENDPOINTS.autoloadUpload,
      json: {},
      rateLimitPerMinute: AVITO_RATE_LIMITS.autoloadUpload,
    });
  }

  async getLastCompletedReportId(ctx: ChannelContext): Promise<string | null> {
    const response = await this.api.request<AvitoAutoloadLastReportResponse>(ctx, {
      method: 'GET',
      path: AVITO_ENDPOINTS.autoloadLastReport,
      endpoint: AVITO_ENDPOINTS.autoloadLastReport,
      rateLimitPerMinute: AVITO_RATE_LIMITS.autoloadReports,
    });

    const id = response?.report_id ?? response?.id;
    return id == null ? null : String(id);
  }

  async getReportItems(
    ctx: ChannelContext,
    reportId: string,
    page: number,
    perPage: number,
  ): Promise<AutoloadReportPage> {
    const path = AVITO_ENDPOINTS.autoloadReportItems.replace('{report_id}', reportId);
    const response = await this.api.request<AvitoAutoloadReportItemsResponse>(ctx, {
      method: 'GET',
      path,
      endpoint: AVITO_ENDPOINTS.autoloadReportItems,
      query: { page, per_page: perPage },
      rateLimitPerMinute: AVITO_RATE_LIMITS.autoloadItems,
    });

    const items = (response.items ?? []).map((item) => ({
      adId: String(item.ad_id),
      avitoId: item.avito_id == null ? null : String(item.avito_id),
      section: item.section?.slug ?? null,
      sectionTitle: item.section?.title ?? null,
      avitoStatus: item.avito_status ?? null,
      url: item.url ?? null,
      messages: (item.messages ?? []).map((message) => ({
        type: message.type,
        code: message.code != null ? String(message.code) : undefined,
        description: message.description ?? message.title,
        title: message.title,
      })),
    }));

    return {
      reportId: String(response.report_id ?? reportId),
      items,
      hasMore: items.length >= perPage,
    };
  }

  async resolveAvitoIds(ctx: ChannelContext, adIds: string[]): Promise<AutoloadIdLink[]> {
    if (adIds.length === 0) {
      return [];
    }

    const response = await this.api.request<AvitoAutoloadAvitoIdsResponse>(ctx, {
      method: 'GET',
      path: AVITO_ENDPOINTS.autoloadAvitoIds,
      endpoint: AVITO_ENDPOINTS.autoloadAvitoIds,
      query: { query: adIds.join(',') },
      rateLimitPerMinute: AVITO_RATE_LIMITS.autoloadIds,
    });

    return (response.items ?? []).map((item) => ({
      adId: item.ad_id ?? null,
      avitoId: String(item.avito_id),
    }));
  }
}

