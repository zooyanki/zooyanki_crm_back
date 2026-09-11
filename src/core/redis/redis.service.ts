import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { AppConfigService } from '../config/app-config.service.js';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    super(config.redisUrl, { maxRetriesPerRequest: null });
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}
