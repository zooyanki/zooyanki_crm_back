import { Module } from '@nestjs/common';

import { ChannelsModule } from '../channels/channels.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { StatsSyncService } from './stats-sync.service.js';

@Module({
  imports: [ChannelsModule, TenancyModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, StatsSyncService],
  exports: [AnalyticsService, StatsSyncService],
})
export class AnalyticsModule {}
