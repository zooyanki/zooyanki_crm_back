import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../../core/config/app-config.service.js';
import { ChannelHttpError } from '../../../core/http/channel-http.error.js';
import type { HttpMethod } from '../../../core/http/channel-http.service.js';
import { ChannelHttpService } from '../../../core/http/channel-http.service.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import { AvitoTokenService } from '../auth/avito-token.service.js';

export interface AvitoRequest {
  method: HttpMethod;
  /// Конкретный путь с подставленными идентификаторами.
  path: string;
  /// Шаблон пути для лимитера и журнала: '/stats/v2/accounts/{user_id}/items'.
  endpoint: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  json?: unknown;
  headers?: Record<string, string>;
  rateLimitPerMinute: number;
  rateLimitMaxWaitMs?: number;
  responseType?: 'json' | 'buffer';
  formData?: FormData;
}

/// Тонкая обёртка: подставляет базовый адрес и токен, а всю механику
/// лимитов, повторов и журналирования делегирует ChannelHttpService.
@Injectable()
export class AvitoApiClient {
  constructor(
    private readonly config: AppConfigService,
    private readonly http: ChannelHttpService,
    private readonly tokens: AvitoTokenService,
  ) {}

  async request<T>(ctx: ChannelContext, req: AvitoRequest): Promise<T> {
    try {
      return await this.send<T>(ctx, req);
    } catch (error) {
      if (!(error instanceof ChannelHttpError) || error.status !== 401) {
        throw error;
      }

      // Токен мог быть отозван до истечения срока: сбрасываем кеш
      // и пробуем один раз с новым.
      await this.tokens.invalidate(ctx);
      return this.send<T>(ctx, req);
    }
  }

  private async send<T>(ctx: ChannelContext, req: AvitoRequest): Promise<T> {
    const accessToken = await this.tokens.getAccessToken(ctx);

    return this.http.request<T>({
      channel: 'AVITO',
      method: req.method,
      url: `${this.config.avitoApiBaseUrl}${req.path}`,
      endpoint: req.endpoint,
      query: req.query,
      json: req.json,
      headers: req.headers,
      accessToken,
      rateLimitPerMinute: req.rateLimitPerMinute,
      rateLimitMaxWaitMs: req.rateLimitMaxWaitMs,
      responseType: req.responseType,
      formData: req.formData,
      tenantId: ctx.tenantId,
      channelAccountId: ctx.channelAccountId,
    });
  }
}
