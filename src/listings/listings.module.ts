import { Module } from '@nestjs/common';

import { ChannelsModule } from '../channels/channels.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { ListingSyncService } from './listing-sync.service.js';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';

@Module({
  imports: [ChannelsModule, TenancyModule],
  controllers: [ListingsController],
  providers: [ListingsService, ListingSyncService],
  exports: [ListingsService, ListingSyncService],
})
export class ListingsModule {}
