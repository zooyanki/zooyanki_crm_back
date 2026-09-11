import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module.js';
import { ChannelAccountsModule } from '../integrations/channel-accounts/channel-accounts.module.js';
import { ListingsModule } from '../listings/listings.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { SyncController } from './sync.controller.js';
import { SyncProcessor } from './sync.processor.js';
import { SyncScheduler } from './sync.scheduler.js';
import { SYNC_QUEUE } from './sync.types.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: SYNC_QUEUE }),
    ChannelAccountsModule,
    ListingsModule,
    AnalyticsModule,
    TenancyModule,
  ],
  controllers: [SyncController],
  providers: [SyncScheduler, SyncProcessor],
  exports: [SyncScheduler],
})
export class SyncModule {}
