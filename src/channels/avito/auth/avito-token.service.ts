import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../../../core/config/app-config.service.js';
import { CryptoService } from '../../../core/crypto/crypto.service.js';
import { PrismaService } from '../../../core/db/prisma.service.js';
import { ChannelHttpService } from '../../../core/http/channel-http.service.js';
import { RedisService } from '../../../core/redis/redis.service.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import { AVITO_ENDPOINTS, AVITO_RATE_LIMITS } from '../avito.constants.js';
import type { AvitoTokenResponse } from '../client/avito-api.types.js';
import { AvitoCredentialsService } from './avito-credentials.service.js';

/// Запас перед истечением: токен не должен протухнуть между проверкой
/// и фактическим запросом.
const EXPIRY_MARGIN_SECONDS = 60;

/// Токен Авито живёт час. Без кеша мы бы выжигали лимит на /token
/// и получали новый токен на каждый вызов синхронизации.
@Injectable()
export class AvitoTokenService {
  private readonly logger = new Logger(AvitoTokenService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly http: ChannelHttpService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly credentials: AvitoCredentialsService,
  ) {}

  async getAccessToken(ctx: ChannelContext): Promise<string> {
    const cacheKey = `avito:token:${ctx.channelAccountId}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const token = await this.requestToken(ctx);
    const ttl = Math.max(EXPIRY_MARGIN_SECONDS, token.expires_in - EXPIRY_MARGIN_SECONDS);

    await this.redis.set(cacheKey, token.access_token, 'EX', ttl);
    await this.persist(ctx, token);

    this.logger.log(`Получен токен Авито для аккаунта ${ctx.channelAccountId}, ttl ${ttl} с`);

    return token.access_token;
  }

  /// Сбрасывает кеш — вызывается, когда площадка ответила 401
  /// и токен, возможно, отозван раньше срока.
  async invalidate(ctx: ChannelContext): Promise<void> {
    await this.redis.del(`avito:token:${ctx.channelAccountId}`);
  }

  private async requestToken(ctx: ChannelContext): Promise<AvitoTokenResponse> {
    const { clientId, clientSecret } = await this.credentials.load(ctx);

    return this.http.request<AvitoTokenResponse>({
      channel: 'AVITO',
      method: 'POST',
      url: `${this.config.avitoApiBaseUrl}${AVITO_ENDPOINTS.token}`,
      endpoint: AVITO_ENDPOINTS.token,
      form: {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      },
      rateLimitPerMinute: AVITO_RATE_LIMITS.token,
      tenantId: ctx.tenantId,
      channelAccountId: ctx.channelAccountId,
    });
  }

  /// Копия в базе нужна для наблюдаемости и для будущего refresh flow:
  /// при authorization_code кеша в Redis уже недостаточно.
  private async persist(ctx: ChannelContext, token: AvitoTokenResponse): Promise<void> {
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);

    await this.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.oauthToken.create({
        data: {
          tenantId: ctx.tenantId,
          channelAccountId: ctx.channelAccountId,
          accessToken: this.crypto.encrypt(token.access_token),
          expiresAt,
        },
      }),
    );
  }
}
