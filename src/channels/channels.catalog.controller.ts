import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ChannelCode } from '../generated/prisma/enums.js';
import { ChannelRegistry } from './channel.registry.js';
import { CHANNEL_TITLE, ENABLED_CHANNELS } from './enabled-channels.js';

export class ChannelCatalogItemDto {
  @ApiProperty({ enum: ChannelCode })
  code!: ChannelCode;

  @ApiProperty()
  title!: string;

  @ApiProperty({ description: 'Можно подключить ключи прямо сейчас' })
  connectable!: boolean;

  @ApiProperty({ description: 'Подсказка, какие данные нужны для подключения' })
  authHint!: string;
}

export class ChannelCatalogResultDto {
  @ApiProperty({ type: [ChannelCatalogItemDto] })
  items!: ChannelCatalogItemDto[];
}

const AUTH_HINT: Partial<Record<ChannelCode, string>> = {
  [ChannelCode.AVITO]:
    'Личный кабинет Авито → Настройки → Доступ к API. Нужны client_id и client_secret персонального приложения (не логин и пароль Авито).',
  [ChannelCode.XO_MARKET]: 'Интеграция в разработке. Подключение ключей появится после адаптера.',
  [ChannelCode.YULA]: 'Интеграция в разработке. Подключение ключей появится после адаптера.',
};

@ApiTags('Площадки')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelsCatalogController {
  constructor(private readonly registry: ChannelRegistry) {}

  @Get()
  @ApiOperation({ summary: 'Список площадок, которые можно предложить пользователю' })
  @ApiOkResponse({ type: ChannelCatalogResultDto })
  list(): ChannelCatalogResultDto {
    return {
      items: ENABLED_CHANNELS.map((code) => ({
        code,
        title: CHANNEL_TITLE[code],
        connectable: this.registry.has(code),
        authHint: AUTH_HINT[code] ?? 'Понадобятся ключи API площадки.',
      })),
    };
  }
}
