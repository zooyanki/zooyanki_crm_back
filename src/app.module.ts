import { Module } from '@nestjs/common';

import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { AppConfigModule } from './core/config/config.module.js';
import { CryptoModule } from './core/crypto/crypto.module.js';
import { PrismaModule } from './core/db/prisma.module.js';
import { ChannelHttpModule } from './core/http/http.module.js';
import { QueueModule } from './core/queue/queue.module.js';
import { RedisModule } from './core/redis/redis.module.js';
import { HealthController } from './health.controller.js';
import { ChannelAccountsModule } from './integrations/channel-accounts/channel-accounts.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { SyncModule } from './sync/sync.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    CryptoModule,
    ChannelHttpModule,
    QueueModule,
    AuthModule,
    TenancyModule,
    ChannelsModule,
    ChannelAccountsModule,
    ListingsModule,
    AnalyticsModule,
    SyncModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
