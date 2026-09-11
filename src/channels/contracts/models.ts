import type { ListingStatus } from '../../generated/prisma/enums.js';

/// Публикация на площадке в нашем представлении.
export interface CanonicalListing {
  externalId: string;
  title: string | null;
  url: string | null;
  price: number | null;
  currency: string;
  categoryId: string | null;
  status: ListingStatus;
  /// Исходный статус площадки — сохраняем, чтобы не терять информацию
  /// при неполном соответствии нашей номенклатуре.
  rawStatus: string | null;
  publishedAt: Date | null;
}

export interface ListingPage {
  items: CanonicalListing[];
  /// null означает, что страниц больше нет.
  nextCursor: string | null;
}

/// Суточная точка метрик по одной публикации.
export interface CanonicalStatsPoint {
  externalId: string;
  date: Date;
  views: number;
  contacts: number;
  favorites: number;
}

export interface StatsQuery {
  externalIds: string[];
  from: Date;
  to: Date;
}

/// Результат проверки подключённого аккаунта.
export interface AccountIdentity {
  externalUserId: string;
  name: string | null;
  email: string | null;
}
