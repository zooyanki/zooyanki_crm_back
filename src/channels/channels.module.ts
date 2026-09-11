import { Module } from '@nestjs/common';

import { AvitoAdapter } from './avito/avito.adapter.js';
import { AvitoModule } from './avito/avito.module.js';
import { CHANNEL_ADAPTERS, ChannelRegistry } from './channel.registry.js';

/// Точка, где адаптеры площадок попадают в реестр. При добавлении Ozon
/// или WB достаточно импортировать их модуль и дописать сюда одну строку —
/// остальное приложение об этом не узнает.
@Module({
  imports: [AvitoModule],
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
