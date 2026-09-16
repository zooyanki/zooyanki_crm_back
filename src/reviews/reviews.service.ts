import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ChannelRegistry } from '../channels/channel.registry.js';
import type { CanonicalReview } from '../channels/contracts/channel-adapter.js';
import type { ChannelContext } from '../channels/contracts/channel-context.js';
import { PrismaService } from '../core/db/prisma.service.js';
import type { ChannelCode } from '../generated/prisma/enums.js';
import { ChannelAccountsService } from '../integrations/channel-accounts/channel-accounts.service.js';

export interface ReviewView {
  id: string;
  channel: ChannelCode;
  channelAccountId: string;
  externalId: string;
  score: number;
  text: string | null;
  stage: string | null;
  canAnswer: boolean;
  itemExternalId: string | null;
  itemTitle: string | null;
  authorName: string | null;
  publishedAt: Date | null;
  answerExternalId: string | null;
  answerText: string | null;
  syncedAt: Date | null;
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: ChannelAccountsService,
    private readonly registry: ChannelRegistry,
  ) {}

  async list(
    tenantId: string,
    page: number,
    perPage: number,
  ): Promise<{ items: ReviewView[]; total: number; page: number; perPage: number }> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.review.findMany({
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * perPage,
          take: perPage,
        }),
        tx.review.count(),
      ]);

      return {
        items: rows.map(toView),
        total,
        page,
        perPage,
      };
    });
  }

  async syncAccount(ctx: ChannelContext, channel: ChannelCode): Promise<{ fetched: number }> {
    const adapter = this.registry.get(channel);
    if (!adapter.reviews) {
      return { fetched: 0 };
    }

    let offset = 0;
    const limit = 50;
    let fetched = 0;

    for (let page = 0; page < 40; page += 1) {
      const batch = await adapter.reviews.fetchReviews(ctx, offset, limit);
      await this.upsertReviews(ctx, channel, batch.items);
      fetched += batch.items.length;
      if (!batch.hasMore) {
        break;
      }
      offset += limit;
    }

    return { fetched };
  }

  async answer(
    tenantId: string,
    reviewId: string,
    text: string,
  ): Promise<ReviewView> {
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      throw new BadRequestException('Ответ слишком короткий');
    }

    const review = await this.prisma.withTenant(tenantId, (tx) =>
      tx.review.findUnique({ where: { id: reviewId } }),
    );
    if (!review) {
      throw new NotFoundException('Отзыв не найден');
    }
    if (!review.canAnswer) {
      throw new BadRequestException('На этот отзыв нельзя ответить');
    }

    const account = await this.accounts.requireForTenant(tenantId, review.channelAccountId);
    const adapter = this.registry.get(account.channel);
    if (!adapter.reviews) {
      throw new BadRequestException('Площадка не поддерживает ответы на отзывы');
    }

    const result = await adapter.reviews.answerReview(
      { tenantId, channelAccountId: review.channelAccountId },
      review.externalId,
      trimmed,
    );

    const updated = await this.prisma.withTenant(tenantId, (tx) =>
      tx.review.update({
        where: { id: reviewId },
        data: {
          answerExternalId: result.answerId,
          answerText: trimmed,
          canAnswer: false,
        },
      }),
    );

    return toView(updated);
  }

  private async upsertReviews(
    ctx: ChannelContext,
    channel: ChannelCode,
    items: CanonicalReview[],
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const syncedAt = new Date();
    await this.prisma.withTenant(ctx.tenantId, async (tx) => {
      for (const item of items) {
        await tx.review.upsert({
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
            score: item.score,
            text: item.text,
            stage: item.stage,
            canAnswer: item.canAnswer,
            itemExternalId: item.itemExternalId,
            itemTitle: item.itemTitle,
            authorName: item.authorName,
            publishedAt: item.publishedAt,
            answerExternalId: item.answerExternalId,
            answerText: item.answerText,
            syncedAt,
          },
          update: {
            score: item.score,
            text: item.text,
            stage: item.stage,
            canAnswer: item.canAnswer,
            itemExternalId: item.itemExternalId,
            itemTitle: item.itemTitle,
            authorName: item.authorName,
            publishedAt: item.publishedAt,
            answerExternalId: item.answerExternalId,
            answerText: item.answerText,
            syncedAt,
          },
        });
      }
    });
  }
}

function toView(row: {
  id: string;
  channel: ChannelCode;
  channelAccountId: string;
  externalId: string;
  score: number;
  text: string | null;
  stage: string | null;
  canAnswer: boolean;
  itemExternalId: string | null;
  itemTitle: string | null;
  authorName: string | null;
  publishedAt: Date | null;
  answerExternalId: string | null;
  answerText: string | null;
  syncedAt: Date | null;
}): ReviewView {
  return {
    id: row.id,
    channel: row.channel,
    channelAccountId: row.channelAccountId,
    externalId: row.externalId,
    score: row.score,
    text: row.text,
    stage: row.stage,
    canAnswer: row.canAnswer,
    itemExternalId: row.itemExternalId,
    itemTitle: row.itemTitle,
    authorName: row.authorName,
    publishedAt: row.publishedAt,
    answerExternalId: row.answerExternalId,
    answerText: row.answerText,
    syncedAt: row.syncedAt,
  };
}

