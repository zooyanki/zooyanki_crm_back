import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { MessagingService } from './messaging.service.js';

@ApiTags('Вебхуки')
@Controller('webhooks/avito')
export class AvitoWebhookController {
  constructor(private readonly messaging: MessagingService) {}

  @Post('messenger/:channelAccountId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Входящий вебхук мессенджера Авито (публичный, без JWT)',
  })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  async messenger(
    @Param('channelAccountId', ParseUUIDPipe) channelAccountId: string,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    // Авито требует 200 за ≤2 с даже на пустой ping.
    if (body && typeof body === 'object') {
      await this.messaging.ingestWebhook(
        channelAccountId,
        body as Parameters<MessagingService['ingestWebhook']>[1],
      );
    }

    return { ok: true };
  }
}

