import { Module } from '@nestjs/common';

import { ChannelAccountsModule } from '../integrations/channel-accounts/channel-accounts.module.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [ChannelAccountsModule, TenancyModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
