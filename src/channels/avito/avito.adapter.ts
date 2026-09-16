import { Injectable } from '@nestjs/common';



import { ChannelCode } from '../../generated/prisma/enums.js';

import { Capability, type ChannelAdapter } from '../contracts/channel-adapter.js';

import { AvitoAuthService } from './auth/avito-auth.service.js';

import { AvitoAutoloadService } from './autoload/avito-autoload.service.js';

import { AvitoListingsService } from './listings/avito-listings.service.js';

import { AvitoMessengerService } from './messenger/avito-messenger.service.js';

import { AvitoOrdersService } from './orders/avito-orders.service.js';

import { AvitoPricingService } from './pricing/avito-pricing.service.js';

import { AvitoReviewsService } from './reviews/avito-reviews.service.js';

import { AvitoStatsService } from './stats/avito-stats.service.js';

import { AvitoStocksService } from './stocks/avito-stocks.service.js';

import { AvitoWalletService } from './wallet/avito-wallet.service.js';



@Injectable()

export class AvitoAdapter implements ChannelAdapter {

  readonly code = ChannelCode.AVITO;



  readonly capabilities: ReadonlySet<Capability> = new Set([

    Capability.READ_LISTINGS,

    Capability.READ_STATS,

    Capability.READ_ORDERS,

    Capability.TRANSITION_ORDERS,

    Capability.WRITE_STOCK,

    Capability.READ_STOCK,

    Capability.WRITE_PRICE,

    Capability.MESSAGING,

    Capability.PUBLISH_LISTINGS,

  ]);



  constructor(

    readonly auth: AvitoAuthService,

    readonly listings: AvitoListingsService,

    readonly stats: AvitoStatsService,

    readonly orders: AvitoOrdersService,

    readonly stocks: AvitoStocksService,

    readonly pricing: AvitoPricingService,

    readonly wallet: AvitoWalletService,

    readonly messaging: AvitoMessengerService,

    readonly autoload: AvitoAutoloadService,

    readonly reviews: AvitoReviewsService,

  ) {}



  get orderTransitions() {

    return this.orders;

  }



  get prices() {

    return this.pricing;

  }



  get promotions() {

    return this.pricing;

  }

}


