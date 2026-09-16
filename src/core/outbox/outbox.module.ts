import { Global, Module } from '@nestjs/common';

import { ChannelsModule } from '../../channels/channels.module.js';
import { ChannelAccountsModule } from '../../integrations/channel-accounts/channel-accounts.module.js';
import { OutboxWorkerService } from './outbox-worker.service.js';
import { OutboxService } from './outbox.service.js';

@Global()
@Module({
  imports: [ChannelsModule, ChannelAccountsModule],
  providers: [OutboxService, OutboxWorkerService],
  exports: [OutboxService],
})
export class OutboxModule {}
