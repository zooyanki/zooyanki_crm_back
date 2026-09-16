import type { ListingStatus, OrderStatus } from '../../generated/prisma/enums.js';

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

/// Расходы на уровне аккаунта за день (без разбивки по объявлениям).
export interface CanonicalSpendingPoint {
  date: Date;
  spending: number;
  currency: string;
}

export interface OrdersPage {
  items: CanonicalOrder[];
  hasMore: boolean;
  nextPage: number | null;
}

export interface CanonicalOrderItem {
  externalId: string | null;
  avitoId: string | null;
  title: string;
  quantity: number;
  price: number;
  total: number;
  currency: string;
}

export interface CanonicalOrder {
  externalId: string;
  marketplaceId: string | null;
  status: OrderStatus;
  rawStatus: string;
  availableActions: unknown;
  totalAmount: number | null;
  commissionAmount: number | null;
  deliveryAmount: number | null;
  discountAmount: number | null;
  currency: string;
  delivery: unknown;
  schedules: unknown;
  placedAt: Date;
  items: CanonicalOrderItem[];
}

/// Результат проверки подключённого аккаунта.
export interface AccountIdentity {
  externalUserId: string;
  name: string | null;
  email: string | null;
}

/// Остаток для публикации на площадке.
export interface StockQuantity {
  /// Идентификатор объявления/позиции на площадке (у Авито — item_id).
  externalId: string;
  quantity: number;
}
