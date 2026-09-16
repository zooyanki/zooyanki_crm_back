import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { StatsSyncService } from '../analytics/stats-sync.service.js';
import { ChannelAccountsService } from '../integrations/channel-accounts/channel-accounts.service.js';
import { StockSyncService } from '../inventory/stock-sync.service.js';
import { ListingSyncService } from '../listings/listing-sync.service.js';
import { ChatSyncService } from '../messaging/chat-sync.service.js';
import { OrderSyncService } from '../orders/order-sync.service.js';
import { ReviewsService } from '../reviews/reviews.service.js';
import { ChannelCode } from '../generated/prisma/enums.js';
import {
  STATS_LOOKBACK_DAYS,
  SYNC_QUEUE,
  type AccountSyncJob,
  type FanoutJob,
  type SyncJob,
} from './sync.types.js';

const POLLED_CHANNELS: ChannelCode[] = [ChannelCode.AVITO];

@Processor(SYNC_QUEUE, { concurrency: 4 })
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue<SyncJob>,
    private readonly accounts: ChannelAccountsService,
    private readonly listingSync: ListingSyncService,
    private readonly statsSync: StatsSyncService,
    private readonly orderSync: OrderSyncService,
    private readonly stockSync: StockSyncService,
    private readonly chatSync: ChatSyncService,
    private readonly reviewsSync: ReviewsService,
  ) {
    super();
  }

  async process(job: Job<SyncJob>): Promise<void> {
    if (job.data.kind === 'fanout') {
      await this.fanout(job.data);
      return;
    }

    await this.syncAccount(job.data);
  }

  private async fanout(job: FanoutJob): Promise<void> {
    let queued = 0;

    for (const channel of POLLED_CHANNELS) {
      const accounts = await this.accounts.listActiveForSync(channel);

      for (const account of accounts) {
        const payload: AccountSyncJob = {
          kind: 'account',
          entity: job.entity,
          tenantId: account.tenantId,
          channelAccountId: account.id,
          channel,
        };

        await this.queue.add('account', payload, {
          jobId: `${job.entity}:${account.id}:${currentWindow()}`,
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
        });

        queued += 1;
      }
    }

    this.logger.log(`Веер ${job.entity}: поставлено задач ${queued}`);
  }

  private async syncAccount(job: AccountSyncJob): Promise<void> {
    const ctx = { tenantId: job.tenantId, channelAccountId: job.channelAccountId };

    if (job.entity === 'listings') {
      await this.listingSync.syncAccount(ctx, job.channel);
      return;
    }

    if (job.entity === 'orders') {
      await this.orderSync.syncAccount(ctx, job.channel);
      return;
    }

    if (job.entity === 'stocks') {
      await this.stockSync.syncAccount(ctx, job.channel);
      return;
    }

    if (job.entity === 'chats') {
      await this.chatSync.syncAccount(ctx, job.channel);
      return;
    }

    if (job.entity === 'reviews') {
      await this.reviewsSync.syncAccount(ctx, job.channel);
      return;
    }

    const to = new Date();
    const from = new Date(to.getTime() - STATS_LOOKBACK_DAYS * 86_400_000);
    await this.statsSync.syncAccount(ctx, job.channel, from, to);
  }
}

function currentWindow(): number {
  return Math.floor(Date.now() / 900_000);
}
