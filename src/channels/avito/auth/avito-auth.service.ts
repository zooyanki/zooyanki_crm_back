import { Injectable } from '@nestjs/common';

import type { ChannelAuth } from '../../contracts/channel-adapter.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import type { AccountIdentity } from '../../contracts/models.js';
import { AVITO_ENDPOINTS, AVITO_RATE_LIMITS } from '../avito.constants.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type { AvitoAccountSelf } from '../client/avito-api.types.js';

@Injectable()
export class AvitoAuthService implements ChannelAuth {
  constructor(private readonly api: AvitoApiClient) {}

  async verify(ctx: ChannelContext): Promise<AccountIdentity> {
    const account = await this.api.request<AvitoAccountSelf>(ctx, {
      method: 'GET',
      path: AVITO_ENDPOINTS.accountSelf,
      endpoint: AVITO_ENDPOINTS.accountSelf,
      rateLimitPerMinute: AVITO_RATE_LIMITS.accountSelf,
    });

    return {
      externalUserId: String(account.id),
      name: account.name ?? null,
      email: account.email ?? null,
    };
  }
}
