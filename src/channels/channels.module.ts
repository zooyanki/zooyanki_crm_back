import { Module } from '@nestjs/common';

import { AvitoAdapter } from './avito/avito.adapter.js';
import { AvitoModule } from './avito/avito.module.js';
import { CHANNEL_ADAPTERS, ChannelRegistry } from './channel.registry.js';
import { ChannelsCatalogController } from './channels.catalog.controller.js';

/// Точка, где адаптеры площадок попадают в реестр. При добавлении новой
/// площадки достаточно импортировать её модуль и дописать сюда одну строку.
@Module({
  imports: [AvitoModule],
  controllers: [ChannelsCatalogController],
  providers: [
    {
      provide: CHANNEL_ADAPTERS,
      useFactory: (avito: AvitoAdapter) => [avito],
      inject: [AvitoAdapter],
    },
    ChannelRegistry,
  ],
  exports: [ChannelRegistry],
})
export class ChannelsModule {}
