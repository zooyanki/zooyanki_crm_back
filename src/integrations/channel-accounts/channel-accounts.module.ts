import { Module } from '@nestjs/common';

import { ChannelsModule } from '../../channels/channels.module.js';
import { TenancyModule } from '../../tenancy/tenancy.module.js';
import { ChannelAccountsController } from './channel-accounts.controller.js';
import { ChannelAccountsService } from './channel-accounts.service.js';

@Module({
  imports: [ChannelsModule, TenancyModule],
  controllers: [ChannelAccountsController],
  providers: [ChannelAccountsService],
  exports: [ChannelAccountsService],
})
export class ChannelAccountsModule {}
