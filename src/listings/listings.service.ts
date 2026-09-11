import { Injectable } from '@nestjs/common';

import { PrismaService } from '../core/db/prisma.service.js';
import type { ChannelCode, ListingStatus } from '../generated/prisma/enums.js';

export interface ListingView {
  id: string;
  channel: ChannelCode;
  channelAccountId: string;
  externalId: string;
  title: string | null;
  url: string | null;
  price: number | null;
  currency: string;
  status: ListingStatus;
  publishedAt: Date | null;
  syncedAt: Date | null;
}

export interface ListingListQuery {
  channelAccountId?: string;
  status?: ListingStatus;
  page: number;
  perPage: number;
}

export interface ListingListResult {
  items: ListingView[];
  total: number;
  page: number;
  perPage: number;
}

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: ListingListQuery): Promise<ListingListResult> {
    const where = {
      ...(query.channelAccountId ? { channelAccountId: query.channelAccountId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    return this.prisma.withTenant(tenantId, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.channelListing.findMany({
          where,
          include: { channelAccount: { select: { channel: true } } },
          orderBy: { publishedAt: 'desc' },
          skip: (query.page - 1) * query.perPage,
          take: query.perPage,
        }),
        tx.channelListing.count({ where }),
      ]);

      return {
        items: rows.map((row) => ({
          id: row.id,
          channel: row.channelAccount.channel,
          channelAccountId: row.channelAccountId,
          externalId: row.externalId,
          title: row.title,
          url: row.url,
          price: row.price === null ? null : Number(row.price),
          currency: row.currency,
          status: row.status,
          publishedAt: row.publishedAt,
          syncedAt: row.syncedAt,
        })),
        total,
        page: query.page,
        perPage: query.perPage,
      };
    });
  }

  /// Идентификаторы объявлений на площадке — нужны синхронизации статистики,
  /// которая запрашивает метрики пачками по external_id.
  async externalIds(tenantId: string, channelAccountId: string): Promise<string[]> {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.channelListing.findMany({
        where: { channelAccountId },
        select: { externalId: true },
      }),
    );

    return rows.map((row) => row.externalId);
  }
}
