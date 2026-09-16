import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ChannelRegistry } from '../channels/channel.registry.js';
import { Capability } from '../channels/contracts/channel-adapter.js';
import type {
  CanonicalConversation,
  CanonicalMessage,
} from '../channels/contracts/channel-adapter.js';
import type { ChannelContext } from '../channels/contracts/channel-context.js';
import { AppConfigService } from '../core/config/app-config.service.js';
import { PrismaService } from '../core/db/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  ChannelCode,
  MessageDirection,
  MessageType,
} from '../generated/prisma/enums.js';
import { ChannelAccountsService } from '../integrations/channel-accounts/channel-accounts.service.js';

export interface ConversationView {
  id: string;
  channel: ChannelCode;
  channelAccountId: string;
  externalId: string;
  listingExternalId: string | null;
  listingTitle: string | null;
  peerExternalId: string | null;
  peerName: string | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  lastMessageDirection: MessageDirection | null;
  syncedAt: Date | null;
}

export interface MessageView {
  id: string;
  conversationId: string;
  externalId: string;
  direction: MessageDirection;
  type: MessageType;
  bodyText: string | null;
  contentJson: unknown;
  authorExternalId: string | null;
  isRead: boolean;
  sentAt: Date;
}

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: ChannelAccountsService,
    private readonly registry: ChannelRegistry,
    private readonly config: AppConfigService,
  ) {}

  async listConversations(
    tenantId: string,
    page: number,
    perPage: number,
  ): Promise<{ items: ConversationView[]; total: number; page: number; perPage: number }> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.conversation.findMany({
          orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
          skip: (page - 1) * perPage,
          take: perPage,
        }),
        tx.conversation.count(),
      ]);

      return {
        items: rows.map(toConversationView),
        total,
        page,
        perPage,
      };
    });
  }

  async listMessages(
    tenantId: string,
    conversationId: string,
    page: number,
    perPage: number,
  ): Promise<{ items: MessageView[]; total: number; page: number; perPage: number }> {
    await this.requireConversation(tenantId, conversationId);

    return this.prisma.withTenant(tenantId, async (tx) => {
      const where = { conversationId };
      const [rows, total] = await Promise.all([
        tx.message.findMany({
          where,
          orderBy: { sentAt: 'asc' },
          skip: (page - 1) * perPage,
          take: perPage,
        }),
        tx.message.count({ where }),
      ]);

      return {
        items: rows.map(toMessageView),
        total,
        page,
        perPage,
      };
    });
  }

  async sendText(
    tenantId: string,
    conversationId: string,
    text: string,
  ): Promise<MessageView> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new BadRequestException('Текст сообщения пуст');
    }
    if (trimmed.length > 1000) {
      throw new BadRequestException('Сообщение длиннее 1000 символов');
    }

    const conversation = await this.requireConversation(tenantId, conversationId);
    const messaging = await this.requireMessaging(tenantId, conversation.channelAccountId);

    const sent = await messaging.sendText(
      { tenantId, channelAccountId: conversation.channelAccountId },
      conversation.externalId,
      trimmed,
    );

    return this.persistOutbound(tenantId, conversation, sent.message);
  }

  async sendImage(
    tenantId: string,
    conversationId: string,
    file: { buffer: Buffer; filename: string; contentType: string },
  ): Promise<MessageView> {
    const conversation = await this.requireConversation(tenantId, conversationId);
    const messaging = await this.requireMessaging(tenantId, conversation.channelAccountId);

    if (!messaging.uploadImage || !messaging.sendImage) {
      throw new BadRequestException('Площадка не умеет отправлять изображения');
    }

    const ctx = { tenantId, channelAccountId: conversation.channelAccountId };
    const imageId = await messaging.uploadImage(ctx, file);
    const sent = await messaging.sendImage(ctx, conversation.externalId, imageId);

    return this.persistOutbound(tenantId, conversation, sent.message);
  }

  async markRead(tenantId: string, conversationId: string): Promise<void> {
    const conversation = await this.requireConversation(tenantId, conversationId);
    const messaging = await this.requireMessaging(tenantId, conversation.channelAccountId);

    if (messaging.markRead) {
      await messaging.markRead(
        { tenantId, channelAccountId: conversation.channelAccountId },
        conversation.externalId,
      );
    }

    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.conversation.update({
        where: { id: conversationId },
        data: { unreadCount: 0 },
      });
      await tx.message.updateMany({
        where: { conversationId, direction: MessageDirection.IN, isRead: false },
        data: { isRead: true },
      });
    });
  }

  async subscribeWebhook(tenantId: string, channelAccountId: string): Promise<{ url: string }> {
    const publicBase = this.config.publicBaseUrl.replace(/\/$/, '');
    if (!publicBase.startsWith('https://')) {
      throw new BadRequestException(
        'Для вебхука нужен PUBLIC_BASE_URL с https:// (требование Авито)',
      );
    }

    const messaging = await this.requireMessaging(tenantId, channelAccountId);
    if (!messaging.subscribeWebhook) {
      throw new BadRequestException('Площадка не поддерживает вебхуки');
    }

    const url = `${publicBase}/api/webhooks/avito/messenger/${channelAccountId}`;
    await messaging.subscribeWebhook(
      { tenantId, channelAccountId },
      url,
    );

    return { url };
  }

  async unsubscribeWebhook(tenantId: string, channelAccountId: string): Promise<void> {
    const publicBase = this.config.publicBaseUrl.replace(/\/$/, '');
    if (!publicBase) {
      throw new BadRequestException('PUBLIC_BASE_URL не задан');
    }

    const messaging = await this.requireMessaging(tenantId, channelAccountId);
    if (!messaging.unsubscribeWebhook) {
      throw new BadRequestException('Площадка не поддерживает вебхуки');
    }

    const url = `${publicBase}/api/webhooks/avito/messenger/${channelAccountId}`;
    await messaging.unsubscribeWebhook({ tenantId, channelAccountId }, url);
  }

  async ingestWebhook(
    channelAccountId: string,
    body: {
      payload?: {
        type?: string;
        value?: {
          id?: string;
          chat_id?: string;
          user_id?: number;
          author_id?: number;
          type?: string;
          content?: unknown;
          created?: number;
          published_at?: string;
          item_id?: number | null;
        };
      };
    },
  ): Promise<void> {
    const account = await this.accounts.findActiveById(channelAccountId);
    if (!account) {
      return;
    }

    const value = body.payload?.value;
    if (!value?.chat_id || !value.id) {
      return;
    }

    const ctx: ChannelContext = {
      tenantId: account.tenantId,
      channelAccountId: account.id,
    };

    const message = mapWebhookMessage(value, account.externalUserId);
    await this.upsertConversationStub(ctx, account.channel, value.chat_id, value.item_id, message);
    await this.upsertMessage(ctx, value.chat_id, message);
  }

  async syncConversationMessages(
    ctx: ChannelContext,
    conversationId: string,
  ): Promise<number> {
    const conversation = await this.requireConversation(ctx.tenantId, conversationId);
    const messaging = await this.requireMessaging(ctx.tenantId, conversation.channelAccountId);

    let offset = 0;
    const limit = 100;
    let fetched = 0;

    for (let page = 0; page < 20; page += 1) {
      const batch = await messaging.fetchMessages(ctx, conversation.externalId, offset, limit);
      for (const item of batch.items) {
        await this.upsertMessage(ctx, conversation.externalId, item);
      }
      fetched += batch.items.length;
      if (!batch.hasMore) {
        break;
      }
      offset += limit;
    }

    if (messaging.markRead) {
      await messaging.markRead(ctx, conversation.externalId);
    }

    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { unreadCount: 0, syncedAt: new Date() },
      });
    });

    return fetched;
  }

  async pullConversationMessages(tenantId: string, conversationId: string): Promise<number> {
    const conversation = await this.requireConversation(tenantId, conversationId);
    return this.syncConversationMessages(
      { tenantId, channelAccountId: conversation.channelAccountId },
      conversationId,
    );
  }

  async upsertConversations(
    ctx: ChannelContext,
    channel: ChannelCode,
    items: CanonicalConversation[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const syncedAt = new Date();

    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      for (const item of items) {
        const last = item.lastMessage;
        await tx.conversation.upsert({
          where: {
            channelAccountId_externalId: {
              channelAccountId: ctx.channelAccountId,
              externalId: item.externalId,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            channelAccountId: ctx.channelAccountId,
            channel,
            externalId: item.externalId,
            listingExternalId: item.listingExternalId,
            listingTitle: item.listingTitle,
            peerExternalId: item.peerExternalId,
            peerName: item.peerName,
            unreadCount: item.unreadCount,
            lastMessageAt: last?.sentAt ?? item.updatedAt,
            lastMessagePreview: previewOf(last),
            lastMessageDirection: last ? toDirection(last.direction) : null,
            syncedAt,
          },
          update: {
            listingExternalId: item.listingExternalId,
            listingTitle: item.listingTitle,
            peerExternalId: item.peerExternalId,
            peerName: item.peerName,
            unreadCount: item.unreadCount,
            lastMessageAt: last?.sentAt ?? item.updatedAt,
            lastMessagePreview: previewOf(last),
            lastMessageDirection: last ? toDirection(last.direction) : null,
            syncedAt,
          },
        });

        if (last) {
          const conversation = await tx.conversation.findUnique({
            where: {
              channelAccountId_externalId: {
                channelAccountId: ctx.channelAccountId,
                externalId: item.externalId,
              },
            },
            select: { id: true },
          });
          if (conversation) {
            await tx.message.upsert({
              where: {
                conversationId_externalId: {
                  conversationId: conversation.id,
                  externalId: last.externalId,
                },
              },
              create: {
                tenantId: ctx.tenantId,
                conversationId: conversation.id,
                externalId: last.externalId,
                direction: toDirection(last.direction),
                type: toMessageType(last.type),
                bodyText: last.bodyText,
                contentJson: last.content as Prisma.InputJsonValue,
                authorExternalId: last.authorExternalId,
                isRead: last.isRead,
                sentAt: last.sentAt,
              },
              update: {
                bodyText: last.bodyText,
                contentJson: last.content as Prisma.InputJsonValue,
                isRead: last.isRead,
              },
            });
          }
        }
      }
    });
  }

  private async upsertConversationStub(
    ctx: ChannelContext,
    channel: ChannelCode,
    chatExternalId: string,
    itemId: number | null | undefined,
    message: CanonicalMessage,
  ): Promise<void> {
    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      await tx.conversation.upsert({
        where: {
          channelAccountId_externalId: {
            channelAccountId: ctx.channelAccountId,
            externalId: chatExternalId,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          channelAccountId: ctx.channelAccountId,
          channel,
          externalId: chatExternalId,
          listingExternalId: itemId != null ? String(itemId) : null,
          unreadCount: message.direction === 'IN' ? 1 : 0,
          lastMessageAt: message.sentAt,
          lastMessagePreview: previewOf(message),
          lastMessageDirection: toDirection(message.direction),
          syncedAt: new Date(),
        },
        update: {
          lastMessageAt: message.sentAt,
          lastMessagePreview: previewOf(message),
          lastMessageDirection: toDirection(message.direction),
          unreadCount:
            message.direction === 'IN'
              ? { increment: 1 }
              : undefined,
          syncedAt: new Date(),
        },
      });
    });
  }

  private async upsertMessage(
    ctx: ChannelContext,
    chatExternalId: string,
    message: CanonicalMessage,
  ): Promise<void> {
    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: {
          channelAccountId_externalId: {
            channelAccountId: ctx.channelAccountId,
            externalId: chatExternalId,
          },
        },
      });

      if (!conversation) {
        return;
      }

      await tx.message.upsert({
        where: {
          conversationId_externalId: {
            conversationId: conversation.id,
            externalId: message.externalId,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          conversationId: conversation.id,
          externalId: message.externalId,
          direction: toDirection(message.direction),
          type: toMessageType(message.type),
          bodyText: message.bodyText,
          contentJson: message.content as Prisma.InputJsonValue,
          authorExternalId: message.authorExternalId,
          isRead: message.isRead,
          sentAt: message.sentAt,
        },
        update: {
          bodyText: message.bodyText,
          contentJson: message.content as Prisma.InputJsonValue,
          isRead: message.isRead,
        },
      });
    });
  }

  private async persistOutbound(
    tenantId: string,
    conversation: { id: string; channelAccountId: string; externalId: string },
    message: CanonicalMessage,
  ): Promise<MessageView> {
    await this.upsertMessage(
      { tenantId, channelAccountId: conversation.channelAccountId },
      conversation.externalId,
      message,
    );

    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: message.sentAt,
          lastMessagePreview: previewOf(message),
          lastMessageDirection: MessageDirection.OUT,
        },
      });
    });

    const saved = await this.prisma.withTenant(tenantId, (tx) =>
      tx.message.findUnique({
        where: {
          conversationId_externalId: {
            conversationId: conversation.id,
            externalId: message.externalId,
          },
        },
      }),
    );

    if (!saved) {
      throw new Error('Сообщение не сохранилось локально');
    }

    return toMessageView(saved);
  }

  private async requireConversation(tenantId: string, conversationId: string) {
    const conversation = await this.prisma.withTenant(tenantId, (tx) =>
      tx.conversation.findUnique({ where: { id: conversationId } }),
    );

    if (!conversation) {
      throw new NotFoundException(`Диалог ${conversationId} не найден`);
    }

    return conversation;
  }

  private async requireMessaging(tenantId: string, channelAccountId: string) {
    const account = await this.accounts.requireForTenant(tenantId, channelAccountId);
    const adapter = this.registry.get(account.channel);

    if (!adapter.messaging || !adapter.capabilities.has(Capability.MESSAGING)) {
      throw new BadRequestException(`Площадка ${account.channel} не умеет мессенджер`);
    }

    return adapter.messaging;
  }
}

function toConversationView(row: {
  id: string;
  channel: ChannelCode;
  channelAccountId: string;
  externalId: string;
  listingExternalId: string | null;
  listingTitle: string | null;
  peerExternalId: string | null;
  peerName: string | null;
  unreadCount: number;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  lastMessageDirection: MessageDirection | null;
  syncedAt: Date | null;
}): ConversationView {
  return {
    id: row.id,
    channel: row.channel,
    channelAccountId: row.channelAccountId,
    externalId: row.externalId,
    listingExternalId: row.listingExternalId,
    listingTitle: row.listingTitle,
    peerExternalId: row.peerExternalId,
    peerName: row.peerName,
    unreadCount: row.unreadCount,
    lastMessageAt: row.lastMessageAt,
    lastMessagePreview: row.lastMessagePreview,
    lastMessageDirection: row.lastMessageDirection,
    syncedAt: row.syncedAt,
  };
}

function toMessageView(row: {
  id: string;
  conversationId: string;
  externalId: string;
  direction: MessageDirection;
  type: MessageType;
  bodyText: string | null;
  contentJson: Prisma.JsonValue | null;
  authorExternalId: string | null;
  isRead: boolean;
  sentAt: Date;
}): MessageView {
  return {
    id: row.id,
    conversationId: row.conversationId,
    externalId: row.externalId,
    direction: row.direction,
    type: row.type,
    bodyText: row.bodyText,
    contentJson: row.contentJson,
    authorExternalId: row.authorExternalId,
    isRead: row.isRead,
    sentAt: row.sentAt,
  };
}

function toDirection(value: 'IN' | 'OUT'): MessageDirection {
  return value === 'IN' ? MessageDirection.IN : MessageDirection.OUT;
}

function toMessageType(value: CanonicalMessage['type']): MessageType {
  switch (value) {
    case 'TEXT':
      return MessageType.TEXT;
    case 'IMAGE':
      return MessageType.IMAGE;
    case 'LINK':
      return MessageType.LINK;
    case 'ITEM':
      return MessageType.ITEM;
    case 'LOCATION':
      return MessageType.LOCATION;
    case 'CALL':
      return MessageType.CALL;
    case 'VOICE':
      return MessageType.VOICE;
    case 'SYSTEM':
      return MessageType.SYSTEM;
    case 'DELETED':
      return MessageType.DELETED;
    default:
      return MessageType.OTHER;
  }
}

function previewOf(message: CanonicalMessage | null | undefined): string | null {
  if (!message) {
    return null;
  }
  if (message.bodyText) {
    return message.bodyText.slice(0, 240);
  }
  return `[${message.type.toLowerCase()}]`;
}

function mapWebhookMessage(
  value: {
    id?: string;
    author_id?: number;
    type?: string;
    content?: unknown;
    created?: number;
    published_at?: string;
  },
  ownerExternalUserId: string | null,
): CanonicalMessage {
  const content = (value.content ?? null) as CanonicalMessage['content'];
  const text =
    content && typeof content === 'object' && content !== null && 'text' in content
      ? String((content as { text?: unknown }).text ?? '') || null
      : null;

  const author = value.author_id != null ? String(value.author_id) : null;
  const direction: CanonicalMessage['direction'] =
    author && ownerExternalUserId && author === ownerExternalUserId ? 'OUT' : 'IN';

  const typeMap: Record<string, CanonicalMessage['type']> = {
    text: 'TEXT',
    image: 'IMAGE',
    link: 'LINK',
    item: 'ITEM',
    location: 'LOCATION',
    call: 'CALL',
    appCall: 'CALL',
    voice: 'VOICE',
    system: 'SYSTEM',
    deleted: 'DELETED',
  };

  const sentAt = value.created
    ? new Date(value.created * 1000)
    : value.published_at
      ? new Date(value.published_at)
      : new Date();

  return {
    externalId: String(value.id),
    direction,
    type: typeMap[value.type ?? ''] ?? 'OTHER',
    bodyText: text,
    content,
    authorExternalId: author,
    isRead: false,
    sentAt,
  };
}

