import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { SYNC_QUEUE, type SyncEntity, type SyncJob } from './sync.types.js';

/// Расписание опроса площадок. Вебхуки есть только у мессенджера Авито,
/// поэтому всё остальное приходится опрашивать.
const SCHEDULE: Array<{ id: string; entity: SyncEntity; pattern: string }> = [
  { id: 'listings-every-30m', entity: 'listings', pattern: '*/30 * * * *' },
  { id: 'stats-nightly', entity: 'stats', pattern: '15 3 * * *' },
];

@Injectable()
export class SyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(@InjectQueue(SYNC_QUEUE) private readonly queue: Queue<SyncJob>) {}

  async onModuleInit(): Promise<void> {
    for (const item of SCHEDULE) {
      await this.queue.upsertJobScheduler(
        item.id,
        { pattern: item.pattern },
        { name: 'fanout', data: { kind: 'fanout', entity: item.entity } },
      );
    }

    this.logger.log(`Зарегистрировано расписаний синхронизации: ${SCHEDULE.length}`);
  }

  /// Ручной запуск из интерфейса: пользователь не должен ждать
  /// следующего срабатывания расписания.
  async triggerNow(job: SyncJob): Promise<void> {
    await this.queue.add(job.kind, job, {
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
}
