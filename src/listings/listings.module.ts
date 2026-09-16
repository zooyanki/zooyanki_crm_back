import { Module } from '@nestjs/common';

import { ChannelsModule } from '../channels/channels.module.js';
import { ChannelAccountsModule } from '../integrations/channel-accounts/channel-accounts.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { ListingSyncService } from './listing-sync.service.js';
import { ListingsController } from './listings.controller.js';
import { ListingsService } from './listings.service.js';

@Module({
  imports: [ChannelsModule, ChannelAccountsModule, TenancyModule],
  controllers: [ListingsController],
  providers: [ListingsService, ListingSyncService],
  exports: [ListingsService, ListingSyncService],
})
export class ListingsModule {}
