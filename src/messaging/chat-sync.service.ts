import { Injectable, Logger } from '@nestjs/common';

import { ChannelRegistry } from '../channels/channel.registry.js';
import { Capability } from '../channels/contracts/channel-adapter.js';
import type { ChannelContext } from '../channels/contracts/channel-context.js';
import { PrismaService } from '../core/db/prisma.service.js';
import type { ChannelCode } from '../generated/prisma/enums.js';
import { MessagingService } from './messaging.service.js';

const SYNC_ENTITY = 'chats';
const PAGE_LIMIT = 50;
const MAX_PAGES = 40;

export interface ChatSyncResult {
  fetched: number;
  pages: number;
}

@Injectable()
export class ChatSyncService {
  private readonly logger = new Logger(ChatSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ChannelRegistry,
    private readonly messaging: MessagingService,
  ) {}

  async syncAccount(ctx: ChannelContext, channel: ChannelCode): Promise<ChatSyncResult> {
    const adapter = this.registry.get(channel);

    if (!adapter.messaging || !adapter.capabilities.has(Capability.MESSAGING)) {
      this.logger.warn(`Площадка ${channel} не умеет мессенджер, синхронизация пропущена`);
      return { fetched: 0, pages: 0 };
    }

    let offset = 0;
    let fetched = 0;
    let pages = 0;

    try {
      for (;;) {
        const batch = await adapter.messaging.fetchConversations(ctx, offset, PAGE_LIMIT);
        await this.messaging.upsertConversations(ctx, channel, batch.items);

        fetched += batch.items.length;
        pages += 1;
        offset += PAGE_LIMIT;

        if (!batch.hasMore || pages >= MAX_PAGES) {
          break;
        }
      }

      await this.recordSuccess(ctx);
      this.logger.log(`Импортировано ${fetched} чатов (${pages} стр.) из ${channel}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.recordFailure(ctx, message);
      throw error;
    }

    return { fetched, pages };
  }

  private async recordSuccess(ctx: ChannelContext): Promise<void> {
    const now = new Date();
    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      await tx.syncState.upsert({
        where: {
          channelAccountId_entity: {
            channelAccountId: ctx.channelAccountId,
            entity: SYNC_ENTITY,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          channelAccountId: ctx.channelAccountId,
          entity: SYNC_ENTITY,
          lastRunAt: now,
          lastSuccessAt: now,
          lastError: null,
        },
        update: {
          lastRunAt: now,
          lastSuccessAt: now,
          lastError: null,
        },
      });

      await tx.channelAccount.update({
        where: { id: ctx.channelAccountId },
        data: { lastSyncAt: now, lastError: null },
      });
    });
  }

  private async recordFailure(ctx: ChannelContext, message: string): Promise<void> {
    const now = new Date();
    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      await tx.syncState.upsert({
        where: {
          channelAccountId_entity: {
            channelAccountId: ctx.channelAccountId,
            entity: SYNC_ENTITY,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          channelAccountId: ctx.channelAccountId,
          entity: SYNC_ENTITY,
          lastRunAt: now,
          lastError: message,
        },
        update: {
          lastRunAt: now,
          lastError: message,
        },
      });
    });
  }
}

