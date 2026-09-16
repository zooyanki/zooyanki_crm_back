import { Injectable } from '@nestjs/common';

import { PrismaService } from '../core/db/prisma.service.js';

export interface DailyTotals {
  date: string;
  views: number;
  contacts: number;
  favorites: number;
  spending: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /// Суточная динамика по всем площадкам арендатора.
  /// Показы/контакты — из StatsDaily, расходы — из StatsAccountDaily.
  async dailyTotals(
    tenantId: string,
    from: Date,
    to: Date,
    channelAccountId?: string,
  ): Promise<DailyTotals[]> {
    const accountFilter = channelAccountId ? { channelAccountId } : {};

    return this.prisma.withTenant(tenantId, async (tx) => {
      const [metrics, spendings] = await Promise.all([
        tx.statsDaily.groupBy({
          by: ['date'],
          where: { date: { gte: from, lte: to }, ...accountFilter },
          _sum: { views: true, contacts: true, favorites: true },
          orderBy: { date: 'asc' },
        }),
        tx.statsAccountDaily.groupBy({
          by: ['date'],
          where: { date: { gte: from, lte: to }, ...accountFilter },
          _sum: { spending: true },
          orderBy: { date: 'asc' },
        }),
      ]);

      const byDate = new Map<string, DailyTotals>();

      for (const row of metrics) {
        const date = row.date.toISOString().slice(0, 10);
        byDate.set(date, {
          date,
          views: row._sum.views ?? 0,
          contacts: row._sum.contacts ?? 0,
          favorites: row._sum.favorites ?? 0,
          spending: 0,
        });
      }

      for (const row of spendings) {
        const date = row.date.toISOString().slice(0, 10);
        const current = byDate.get(date) ?? {
          date,
          views: 0,
          contacts: 0,
          favorites: 0,
          spending: 0,
        };
        current.spending = Number(row._sum.spending ?? 0);
        byDate.set(date, current);
      }

      return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    });
  }
}
