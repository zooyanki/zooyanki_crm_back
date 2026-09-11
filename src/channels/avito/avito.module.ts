import { Module } from '@nestjs/common';

import { AvitoAdapter } from './avito.adapter.js';
import { AvitoAuthService } from './auth/avito-auth.service.js';
import { AvitoCredentialsService } from './auth/avito-credentials.service.js';
import { AvitoTokenService } from './auth/avito-token.service.js';
import { AvitoApiClient } from './client/avito-api.client.js';
import { AvitoListingsService } from './listings/avito-listings.service.js';
import { AvitoStatsService } from './stats/avito-stats.service.js';

@Module({
  providers: [
    AvitoCredentialsService,
    AvitoTokenService,
    AvitoApiClient,
    AvitoAuthService,
    AvitoListingsService,
    AvitoStatsService,
    AvitoAdapter,
  ],
  exports: [AvitoAdapter],
})
export class AvitoModule {}
