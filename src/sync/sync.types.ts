import type { ChannelCode } from '../generated/prisma/enums.js';

export const SYNC_QUEUE = 'channel-sync';

export type SyncEntity = 'listings' | 'stats';

/// Веерная задача: обходит активные аккаунты и ставит по задаче на каждый.
/// Нужна потому, что расписание одно, а аккаунтов много.
export interface FanoutJob {
  kind: 'fanout';
  entity: SyncEntity;
}

export interface AccountSyncJob {
  kind: 'account';
  entity: SyncEntity;
  tenantId: string;
  channelAccountId: string;
  channel: ChannelCode;
}

export type SyncJob = FanoutJob | AccountSyncJob;

/// Глубина окна при ночном сборе статистики. Площадка досчитывает метрики
/// задним числом, поэтому перезапрашиваем последние дни, а не только вчера.
export const STATS_LOOKBACK_DAYS = 7;
