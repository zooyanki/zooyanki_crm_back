import { Module } from '@nestjs/common';

import { ChannelsModule } from '../channels/channels.module.js';
import { ChannelAccountsModule } from '../integrations/channel-accounts/channel-accounts.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AutoloadController } from './autoload.controller.js';
import { AutoloadService } from './autoload.service.js';
import { PublicFeedController } from './public-feed.controller.js';

@Module({
  imports: [ChannelsModule, ChannelAccountsModule, TenancyModule],
  controllers: [AutoloadController, PublicFeedController],
  providers: [AutoloadService],
  exports: [AutoloadService],
})
export class AutoloadModule {}

