import { Injectable } from '@nestjs/common';

import type {
  CanonicalReview,
  ReviewsPage,
  ReviewsProvider,
} from '../../contracts/channel-adapter.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import { AVITO_ENDPOINTS, AVITO_RATE_LIMITS } from '../avito.constants.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type {
  AvitoCreateAnswerResponse,
  AvitoReviewsResponse,
} from '../client/avito-api.types.js';

@Injectable()
export class AvitoReviewsService implements ReviewsProvider {
  constructor(private readonly api: AvitoApiClient) {}

  async fetchReviews(
    ctx: ChannelContext,
    offset: number,
    limit: number,
  ): Promise<ReviewsPage> {
    const response = await this.api.request<AvitoReviewsResponse>(ctx, {
      method: 'GET',
      path: AVITO_ENDPOINTS.reviews,
      endpoint: AVITO_ENDPOINTS.reviews,
      query: { offset, limit },
      rateLimitPerMinute: AVITO_RATE_LIMITS.reviews,
    });

    const rows = response.reviews ?? response.result?.reviews ?? [];
    const items = rows.map(mapReview);

    return {
      items,
      hasMore: items.length >= limit,
    };
  }

  async answerReview(
    ctx: ChannelContext,
    reviewExternalId: string,
    text: string,
  ): Promise<{ answerId: string }> {
    const response = await this.api.request<AvitoCreateAnswerResponse>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.reviewAnswers,
      endpoint: AVITO_ENDPOINTS.reviewAnswers,
      json: {
        reviewId: Number(reviewExternalId),
        text,
      },
      rateLimitPerMinute: AVITO_RATE_LIMITS.reviewAnswers,
    });

    const answerId = response.answerId ?? response.id ?? response.result?.id;
    if (answerId == null) {
      throw new Error('Авито не вернула id ответа на отзыв');
    }

    return { answerId: String(answerId) };
  }

  async deleteAnswer(ctx: ChannelContext, answerExternalId: string): Promise<void> {
    const path = AVITO_ENDPOINTS.reviewAnswerById.replace(
      '{answer_id}',
      answerExternalId,
    );

    await this.api.request<unknown>(ctx, {
      method: 'DELETE',
      path,
      endpoint: AVITO_ENDPOINTS.reviewAnswerById,
      rateLimitPerMinute: AVITO_RATE_LIMITS.reviewAnswers,
    });
  }
}

function mapReview(raw: {
  id?: number | string;
  score?: number;
  rating?: number;
  text?: string | null;
  stage?: string | null;
  canAnswer?: boolean;
  createdAt?: string;
  created_at?: string;
  sender?: { name?: string };
  author?: { name?: string };
  itemInfo?: { itemId?: number; title?: string };
  item?: { id?: number; title?: string };
  answer?: { id?: number | string; text?: string } | null;
}): CanonicalReview {
  const published = raw.createdAt ?? raw.created_at ?? null;
  return {
    externalId: String(raw.id),
    score: Number(raw.score ?? raw.rating ?? 0),
    text: raw.text ?? null,
    stage: raw.stage ?? null,
    canAnswer: Boolean(raw.canAnswer),
    itemExternalId:
      raw.itemInfo?.itemId != null
        ? String(raw.itemInfo.itemId)
        : raw.item?.id != null
          ? String(raw.item.id)
          : null,
    itemTitle: raw.itemInfo?.title ?? raw.item?.title ?? null,
    authorName: raw.sender?.name ?? raw.author?.name ?? null,
    publishedAt: published ? new Date(published) : null,
    answerExternalId: raw.answer?.id != null ? String(raw.answer.id) : null,
    answerText: raw.answer?.text ?? null,
  };
}

