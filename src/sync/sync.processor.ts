import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { StatsSyncService } from '../analytics/stats-sync.service.js';
import { ChannelAccountsService } from '../integrations/channel-accounts/channel-accounts.service.js';
import { ListingSyncService } from '../listings/listing-sync.service.js';
import { ChannelCode } from '../generated/prisma/enums.js';
import {
  STATS_LOOKBACK_DAYS,
  SYNC_QUEUE,
  type AccountSyncJob,
  type FanoutJob,
  type SyncJob,
} from './sync.types.js';

/// Площадки, которые опрашиваются по расписанию. Ozon, WB и Drom
/// добавляются сюда вместе со своими адаптерами.
const POLLED_CHANNELS: ChannelCode[] = [ChannelCode.AVITO];

@Processor(SYNC_QUEUE, { concurrency: 4 })
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    @InjectQueue(SYNC_QUEUE) private readonly queue: Queue<SyncJob>,
    private readonly accounts: ChannelAccountsService,
    private readonly listingSync: ListingSyncService,
    private readonly statsSync: StatsSyncService,
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

        // Идентификатор задачи делает постановку идемпотентной: повторный
        // веер в то же окно не создаст дубль работы.
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

    const to = new Date();
    const from = new Date(to.getTime() - STATS_LOOKBACK_DAYS * 86_400_000);

    await this.statsSync.syncAccount(ctx, job.channel, from, to);
  }
}

/// Пятнадцатиминутное окно: достаточно грубое, чтобы гасить дубли
/// от повторных веерных запусков, и достаточно мелкое, чтобы не блокировать
/// ручной перезапуск надолго.
function currentWindow(): number {
  return Math.floor(Date.now() / 900_000);
}
