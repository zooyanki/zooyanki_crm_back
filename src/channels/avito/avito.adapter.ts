import { Injectable } from '@nestjs/common';

import { ChannelCode } from '../../generated/prisma/enums.js';
import { Capability, type ChannelAdapter } from '../contracts/channel-adapter.js';
import { AvitoAuthService } from './auth/avito-auth.service.js';
import { AvitoListingsService } from './listings/avito-listings.service.js';
import { AvitoStatsService } from './stats/avito-stats.service.js';

/// Возможности перечислены по факту реализованного. Записи цен, заказов
/// и мессенджера пока нет — они появятся в следующих фазах вместе
/// с соответствующими сервисами.
///
/// Публикации объявлений у Авито не будет и дальше в виде прямого вызова:
/// площадка принимает их только через XML-фид автозагрузки.
@Injectable()
export class AvitoAdapter implements ChannelAdapter {
  readonly code = ChannelCode.AVITO;

  readonly capabilities: ReadonlySet<Capability> = new Set([
    Capability.READ_LISTINGS,
    Capability.READ_STATS,
  ]);

  constructor(
    readonly auth: AvitoAuthService,
    readonly listings: AvitoListingsService,
    readonly stats: AvitoStatsService,
  ) {}
}
