import type { ChannelCode } from '../../generated/prisma/enums.js';
import type { ChannelContext } from './channel-context.js';
import type { AccountIdentity, CanonicalStatsPoint, ListingPage, StatsQuery } from './models.js';

/// Возможности площадки. Они разные: у Авито нет создания объявлений
/// через REST, у Drom беднее весь набор. Адаптер объявляет, что умеет,
/// а бизнес-логика проверяет это перед вызовом.
export enum Capability {
  READ_LISTINGS = 'READ_LISTINGS',
  WRITE_PRICE = 'WRITE_PRICE',
  WRITE_STOCK = 'WRITE_STOCK',
  READ_ORDERS = 'READ_ORDERS',
  TRANSITION_ORDERS = 'TRANSITION_ORDERS',
  READ_STATS = 'READ_STATS',
  MESSAGING = 'MESSAGING',
  PUBLISH_LISTINGS = 'PUBLISH_LISTINGS',
}

export interface ChannelAuth {
  /// Проверяет учётные данные и возвращает идентификатор аккаунта
  /// на стороне площадки.
  verify(ctx: ChannelContext): Promise<AccountIdentity>;
}

export interface ListingReader {
  /// Постраничный обход публикаций. Курсор непрозрачен для вызывающего кода:
  /// у одной площадки это номер страницы, у другой — токен.
  fetchListings(ctx: ChannelContext, cursor: string | null): Promise<ListingPage>;
}

export interface StatsReader {
  fetchDailyStats(ctx: ChannelContext, query: StatsQuery): Promise<CanonicalStatsPoint[]>;
}

export interface ChannelAdapter {
  readonly code: ChannelCode;
  readonly capabilities: ReadonlySet<Capability>;

  readonly auth: ChannelAuth;
  readonly listings?: ListingReader;
  readonly stats?: StatsReader;
}
