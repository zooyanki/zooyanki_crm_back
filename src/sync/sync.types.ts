import type { ChannelCode } from '../generated/prisma/enums.js';

export const SYNC_QUEUE = 'channel-sync';

export type SyncEntity = 'listings' | 'stats' | 'orders' | 'chats' | 'reviews' | 'stocks';

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

export const STATS_LOOKBACK_DAYS = 7;
