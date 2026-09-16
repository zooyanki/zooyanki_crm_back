import { Module } from '@nestjs/common';

import { ChannelsModule } from '../channels/channels.module.js';
import { ChannelAccountsModule } from '../integrations/channel-accounts/channel-accounts.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './wallet.service.js';

@Module({
  imports: [ChannelsModule, ChannelAccountsModule, TenancyModule],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}

