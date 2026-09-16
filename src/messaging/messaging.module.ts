import { Module } from '@nestjs/common';

import { ChannelsModule } from '../channels/channels.module.js';
import { ChannelAccountsModule } from '../integrations/channel-accounts/channel-accounts.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AvitoWebhookController } from './avito-webhook.controller.js';
import { ChatSyncService } from './chat-sync.service.js';
import { MessagingController } from './messaging.controller.js';
import { MessagingService } from './messaging.service.js';

@Module({
  imports: [ChannelsModule, ChannelAccountsModule, TenancyModule],
  controllers: [MessagingController, AvitoWebhookController],
  providers: [MessagingService, ChatSyncService],
  exports: [MessagingService, ChatSyncService],
})
export class MessagingModule {}

