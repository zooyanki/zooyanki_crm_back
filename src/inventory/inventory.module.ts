import { Module } from '@nestjs/common';

import { ChannelsModule } from '../channels/channels.module.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { StockSyncService } from './stock-sync.service.js';

@Module({
  imports: [ChannelsModule],
  controllers: [InventoryController],
  providers: [InventoryService, StockSyncService],
  exports: [InventoryService, StockSyncService],
})
export class InventoryModule {}
