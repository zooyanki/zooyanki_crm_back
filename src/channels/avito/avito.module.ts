import { Module } from '@nestjs/common';

import { AvitoAdapter } from './avito.adapter.js';
import { AvitoAuthService } from './auth/avito-auth.service.js';
import { AvitoCredentialsService } from './auth/avito-credentials.service.js';
import { AvitoTokenService } from './auth/avito-token.service.js';
import { AvitoApiClient } from './client/avito-api.client.js';
import { AvitoAutoloadService } from './autoload/avito-autoload.service.js';
import { AvitoListingsService } from './listings/avito-listings.service.js';
import { AvitoMessengerService } from './messenger/avito-messenger.service.js';
import { AvitoOrdersService } from './orders/avito-orders.service.js';
import { AvitoPricingService } from './pricing/avito-pricing.service.js';
import { AvitoReviewsService } from './reviews/avito-reviews.service.js';
import { AvitoStatsService } from './stats/avito-stats.service.js';
import { AvitoStocksService } from './stocks/avito-stocks.service.js';
import { AvitoWalletService } from './wallet/avito-wallet.service.js';

@Module({
  providers: [
    AvitoCredentialsService,
    AvitoTokenService,
    AvitoApiClient,
    AvitoAuthService,
    AvitoListingsService,
    AvitoStatsService,
    AvitoOrdersService,
    AvitoStocksService,
    AvitoPricingService,
    AvitoWalletService,
    AvitoMessengerService,
    AvitoAutoloadService,
    AvitoReviewsService,
    AvitoAdapter,
  ],
  exports: [AvitoAdapter],
})
export class AvitoModule {}
