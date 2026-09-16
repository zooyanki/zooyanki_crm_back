import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import {
  ConversationListResultDto,
  ListConversationsQueryDto,
  ListMessagesQueryDto,
  MessageListResultDto,
  MessageViewDto,
  SendTextMessageDto,
  SubscribeWebhookDto,
  WebhookSubscribeResultDto,
} from './messaging.dto.js';
import { MessagingService } from './messaging.service.js';

@ApiTags('Мессенджер')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Список диалогов' })
  @ApiOkResponse({ type: ConversationListResultDto })
  listConversations(
    @CurrentTenant() tenantId: string,
    @Query() query: ListConversationsQueryDto,
  ): Promise<ConversationListResultDto> {
    return this.messaging.listConversations(tenantId, query.page, query.perPage);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Сообщения диалога' })
  @ApiOkResponse({ type: MessageListResultDto })
  listMessages(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<MessageListResultDto> {
    return this.messaging.listMessages(tenantId, id, query.page, query.perPage);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Отправить текстовое сообщение' })
  @ApiOkResponse({ type: MessageViewDto })
  sendText(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendTextMessageDto,
  ): Promise<MessageViewDto> {
    return this.messaging.sendText(tenantId, id, body.text);
  }

  @Post('conversations/:id/messages/image')
  @ApiOperation({ summary: 'Отправить изображение' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: MessageViewDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 24 * 1024 * 1024 },
    }),
  )
  sendImage(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MessageViewDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Файл изображения не передан');
    }

    return this.messaging.sendImage(tenantId, id, {
      buffer: file.buffer,
      filename: file.originalname || 'image.jpg',
      contentType: file.mimetype || 'image/jpeg',
    });
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Пометить диалог прочитанным' })
  async markRead(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    await this.messaging.markRead(tenantId, id);
    return { ok: true };
  }

  @Post('conversations/:id/sync')
  @ApiOperation({ summary: 'Подтянуть сообщения диалога с площадки' })
  async syncMessages(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ fetched: number }> {
    const fetched = await this.messaging.pullConversationMessages(tenantId, id);
    return { fetched };
  }

  @Post('webhook/subscribe')
  @ApiOperation({ summary: 'Подписать URL вебхука Авито на этот инстанс' })
  @ApiOkResponse({ type: WebhookSubscribeResultDto })
  subscribe(
    @CurrentTenant() tenantId: string,
    @Body() body: SubscribeWebhookDto,
  ): Promise<WebhookSubscribeResultDto> {
    return this.messaging.subscribeWebhook(tenantId, body.channelAccountId);
  }

  @Post('webhook/unsubscribe')
  @ApiOperation({ summary: 'Отписать вебхук Авито' })
  async unsubscribe(
    @CurrentTenant() tenantId: string,
    @Body() body: SubscribeWebhookDto,
  ): Promise<{ ok: true }> {
    await this.messaging.unsubscribeWebhook(tenantId, body.channelAccountId);
    return { ok: true };
  }
}

