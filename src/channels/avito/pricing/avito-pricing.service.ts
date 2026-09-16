import { Injectable } from '@nestjs/common';

import type {
  ApplyVasInput,
  PriceWriter,
  PromotionWriter,
  VasOffer,
} from '../../contracts/channel-adapter.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import { AVITO_ENDPOINTS, AVITO_RATE_LIMITS } from '../avito.constants.js';
import { AvitoCredentialsService } from '../auth/avito-credentials.service.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type {
  AvitoApplyVasRequest,
  AvitoApplyVasResponse,
  AvitoUpdatePriceRequest,
  AvitoUpdatePriceResponse,
  AvitoVasPricesResponse,
} from '../client/avito-api.types.js';

@Injectable()
export class AvitoPricingService implements PriceWriter, PromotionWriter {
  constructor(
    private readonly api: AvitoApiClient,
    private readonly credentials: AvitoCredentialsService,
  ) {}

  async updatePrice(ctx: ChannelContext, externalId: string, price: number): Promise<void> {
    const path = AVITO_ENDPOINTS.updatePrice.replace('{item_id}', externalId);
    const body: AvitoUpdatePriceRequest = { price };

    const response = await this.api.request<AvitoUpdatePriceResponse>(ctx, {
      method: 'POST',
      path,
      endpoint: AVITO_ENDPOINTS.updatePrice,
      json: body,
      rateLimitPerMinute: AVITO_RATE_LIMITS.updatePrice,
    });

    const ok = response.success === true || response.result?.success === true;
    if (response.success === false || response.result?.success === false) {
      throw new Error(`Авито отклонила новую цену для объявления ${externalId}`);
    }

    // Некоторые ответы приходят без явного success — считаем 200 достаточным.
    void ok;
  }

  async fetchVasPrices(ctx: ChannelContext, externalIds: string[]): Promise<VasOffer[]> {
    if (externalIds.length === 0) {
      return [];
    }

    const userId = await this.credentials.externalUserId(ctx);
    const path = AVITO_ENDPOINTS.vasPrices.replace('{userId}', userId);

    const response = await this.api.request<AvitoVasPricesResponse>(ctx, {
      method: 'POST',
      path,
      endpoint: AVITO_ENDPOINTS.vasPrices,
      json: { itemIds: externalIds.map(Number) },
      rateLimitPerMinute: AVITO_RATE_LIMITS.vasPrices,
    });

    const rows = Array.isArray(response) ? response : [];
    return rows.map((row) => ({
      externalId: String(row.itemId),
      vas: (row.vas ?? []).map((item) => ({
        slug: item.slug,
        price: item.price,
        priceOld: item.priceOld,
      })),
      stickers: (row.stickers ?? []).map((sticker) => ({
        id: sticker.id,
        title: sticker.title,
        description: sticker.description,
      })),
    }));
  }

  async applyVas(ctx: ChannelContext, input: ApplyVasInput): Promise<void> {
    if (input.slugs.length === 0) {
      throw new Error('Укажите хотя бы одну услугу продвижения');
    }

    const path = AVITO_ENDPOINTS.applyVas.replace('{itemId}', input.externalId);
    const body: AvitoApplyVasRequest = {
      slugs: input.slugs,
      ...(input.stickers?.length ? { stickers: input.stickers } : {}),
    };

    await this.api.request<AvitoApplyVasResponse>(ctx, {
      method: 'PUT',
      path,
      endpoint: AVITO_ENDPOINTS.applyVas,
      json: body,
      rateLimitPerMinute: AVITO_RATE_LIMITS.applyVas,
    });
  }
}

