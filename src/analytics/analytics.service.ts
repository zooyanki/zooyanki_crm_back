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
  /// Агрегируем в базе, а не в приложении: выборка за квартал
  /// по тысяче объявлений — это сотни тысяч строк.
  async dailyTotals(tenantId: string, from: Date, to: Date): Promise<DailyTotals[]> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const rows = await tx.statsDaily.groupBy({
        by: ['date'],
        where: { date: { gte: from, lte: to } },
        _sum: { views: true, contacts: true, favorites: true, spending: true },
        orderBy: { date: 'asc' },
      });

      return rows.map((row) => ({
        date: row.date.toISOString().slice(0, 10),
        views: row._sum.views ?? 0,
        contacts: row._sum.contacts ?? 0,
        favorites: row._sum.favorites ?? 0,
        spending: Number(row._sum.spending ?? 0),
      }));
    });
  }
}
