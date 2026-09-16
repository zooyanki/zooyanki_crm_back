import { Injectable } from '@nestjs/common';

import type {
  CanonicalConversation,
  CanonicalMessage,
  ConversationsPage,
  MessagesPage,
  MessagingProvider,
  SentMessage,
} from '../../contracts/channel-adapter.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import { AVITO_ENDPOINTS, AVITO_RATE_LIMITS } from '../avito.constants.js';
import { AvitoCredentialsService } from '../auth/avito-credentials.service.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type {
  AvitoChat,
  AvitoChatsResponse,
  AvitoMessage,
  AvitoMessagesResponse,
  AvitoSendMessageResponse,
  AvitoUploadImagesResponse,
} from '../client/avito-api.types.js';

@Injectable()
export class AvitoMessengerService implements MessagingProvider {
  constructor(
    private readonly api: AvitoApiClient,
    private readonly credentials: AvitoCredentialsService,
  ) {}

  async fetchConversations(
    ctx: ChannelContext,
    offset: number,
    limit: number,
  ): Promise<ConversationsPage> {
    const userId = await this.credentials.externalUserId(ctx);
    const path = AVITO_ENDPOINTS.chats.replace('{user_id}', userId);

    const response = await this.api.request<AvitoChatsResponse>(ctx, {
      method: 'GET',
      path,
      endpoint: AVITO_ENDPOINTS.chats,
      query: { offset, limit },
      rateLimitPerMinute: AVITO_RATE_LIMITS.chats,
    });

    const items = (response.chats ?? []).map((chat) => toCanonicalConversation(chat, userId));
    return {
      items,
      hasMore: items.length >= limit,
    };
  }

  async fetchMessages(
    ctx: ChannelContext,
    chatExternalId: string,
    offset: number,
    limit: number,
  ): Promise<MessagesPage> {
    const userId = await this.credentials.externalUserId(ctx);
    const path = AVITO_ENDPOINTS.chatMessages
      .replace('{user_id}', userId)
      .replace('{chat_id}', chatExternalId);

    const response = await this.api.request<AvitoMessagesResponse>(ctx, {
      method: 'GET',
      path,
      endpoint: AVITO_ENDPOINTS.chatMessages,
      query: { offset, limit },
      rateLimitPerMinute: AVITO_RATE_LIMITS.chatMessages,
    });

    const rows = Array.isArray(response) ? response : (response.messages ?? []);
    const items = rows.map(toCanonicalMessage);

    return {
      items,
      hasMore: items.length >= limit,
    };
  }

  async sendText(
    ctx: ChannelContext,
    chatExternalId: string,
    text: string,
  ): Promise<SentMessage> {
    const userId = await this.credentials.externalUserId(ctx);
    const path = AVITO_ENDPOINTS.sendMessage
      .replace('{user_id}', userId)
      .replace('{chat_id}', chatExternalId);

    const response = await this.api.request<AvitoSendMessageResponse>(ctx, {
      method: 'POST',
      path,
      endpoint: AVITO_ENDPOINTS.sendMessage,
      json: {
        type: 'text',
        message: { text },
      },
      rateLimitPerMinute: AVITO_RATE_LIMITS.sendMessage,
    });

    return { message: toCanonicalMessage(response) };
  }

  async uploadImage(
    ctx: ChannelContext,
    file: { buffer: Buffer; filename: string; contentType: string },
  ): Promise<string> {
    const userId = await this.credentials.externalUserId(ctx);
    const path = AVITO_ENDPOINTS.uploadImages.replace('{user_id}', userId);

    const formData = new FormData();
    formData.append(
      'uploadfile[]',
      new Blob([new Uint8Array(file.buffer)], { type: file.contentType }),
      file.filename,
    );

    const response = await this.api.request<AvitoUploadImagesResponse>(ctx, {
      method: 'POST',
      path,
      endpoint: AVITO_ENDPOINTS.uploadImages,
      formData,
      rateLimitPerMinute: AVITO_RATE_LIMITS.uploadImages,
    });

    const imageId = Object.keys(response ?? {})[0];
    if (!imageId) {
      throw new Error('Авито не вернула id загруженного изображения');
    }

    return imageId;
  }

  async sendImage(
    ctx: ChannelContext,
    chatExternalId: string,
    imageId: string,
  ): Promise<SentMessage> {
    const userId = await this.credentials.externalUserId(ctx);
    const path = AVITO_ENDPOINTS.sendImageMessage
      .replace('{user_id}', userId)
      .replace('{chat_id}', chatExternalId);

    const response = await this.api.request<AvitoSendMessageResponse>(ctx, {
      method: 'POST',
      path,
      endpoint: AVITO_ENDPOINTS.sendImageMessage,
      json: { image_id: imageId },
      rateLimitPerMinute: AVITO_RATE_LIMITS.sendImageMessage,
    });

    return { message: toCanonicalMessage(response) };
  }

  async markRead(ctx: ChannelContext, chatExternalId: string): Promise<void> {
    const userId = await this.credentials.externalUserId(ctx);
    const path = AVITO_ENDPOINTS.chatRead
      .replace('{user_id}', userId)
      .replace('{chat_id}', chatExternalId);

    await this.api.request<unknown>(ctx, {
      method: 'POST',
      path,
      endpoint: AVITO_ENDPOINTS.chatRead,
      json: {},
      rateLimitPerMinute: AVITO_RATE_LIMITS.chatRead,
    });
  }

  async subscribeWebhook(ctx: ChannelContext, url: string): Promise<void> {
    await this.api.request<unknown>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.webhookSubscribe,
      endpoint: AVITO_ENDPOINTS.webhookSubscribe,
      json: { url },
      rateLimitPerMinute: AVITO_RATE_LIMITS.webhook,
    });
  }

  async unsubscribeWebhook(ctx: ChannelContext, url: string): Promise<void> {
    await this.api.request<unknown>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.webhookUnsubscribe,
      endpoint: AVITO_ENDPOINTS.webhookUnsubscribe,
      json: { url },
      rateLimitPerMinute: AVITO_RATE_LIMITS.webhook,
    });
  }
}

function toCanonicalConversation(chat: AvitoChat, ownerUserId: string): CanonicalConversation {
  const users = chat.users ?? [];
  const peer = users.find((user) => String(user.id) !== ownerUserId) ?? users[0];
  const context = chat.context?.value;
  const last = chat.last_message ? toCanonicalMessage(chat.last_message) : null;

  return {
    externalId: chat.id,
    listingExternalId: context?.id != null ? String(context.id) : null,
    listingTitle: context?.title ?? null,
    peerExternalId: peer?.id != null ? String(peer.id) : null,
    peerName: peer?.name ?? null,
    unreadCount: 0,
    lastMessage: last,
    updatedAt: unixToDate(chat.updated ?? chat.created ?? last?.sentAt.getTime()),
  };
}

function toCanonicalMessage(raw: AvitoMessage): CanonicalMessage {
  const type = mapMessageType(raw.type);
  const text = raw.content?.text ?? null;
  const previewImage = raw.content?.image?.sizes?.['140x105'] ?? null;

  return {
    externalId: raw.id,
    direction: raw.direction === 'in' ? 'IN' : 'OUT',
    type,
    bodyText: text ?? (previewImage ? '[изображение]' : null),
    content: raw.content ?? null,
    authorExternalId: raw.author_id != null ? String(raw.author_id) : null,
    isRead: Boolean(raw.is_read ?? raw.read),
    sentAt: unixToDate(raw.created),
  };
}

function mapMessageType(raw?: string): CanonicalMessage['type'] {
  switch (raw) {
    case 'text':
      return 'TEXT';
    case 'image':
      return 'IMAGE';
    case 'link':
      return 'LINK';
    case 'item':
      return 'ITEM';
    case 'location':
      return 'LOCATION';
    case 'call':
    case 'appCall':
      return 'CALL';
    case 'voice':
      return 'VOICE';
    case 'system':
      return 'SYSTEM';
    case 'deleted':
      return 'DELETED';
    default:
      return 'OTHER';
  }
}

function unixToDate(value?: number | Date | null): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000);
  }
  return new Date();
}

