import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AnalyticsModule } from './analytics/analytics.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { AppConfigModule } from './core/config/config.module.js';
import { CryptoModule } from './core/crypto/crypto.module.js';
import { PrismaModule } from './core/db/prisma.module.js';
import { ChannelHttpModule } from './core/http/http.module.js';
import { OutboxModule } from './core/outbox/outbox.module.js';
import { QueueModule } from './core/queue/queue.module.js';
import { RedisModule } from './core/redis/redis.module.js';
import { HealthController } from './health.controller.js';
import { ChannelAccountsModule } from './integrations/channel-accounts/channel-accounts.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { SyncModule } from './sync/sync.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { WalletModule } from './wallet/wallet.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { AutoloadModule } from './autoload/autoload.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AppConfigModule,
    PrismaModule,
    RedisModule,
    CryptoModule,
    ChannelHttpModule,
    QueueModule,
    OutboxModule,
    AuthModule,
    TenancyModule,
    ChannelsModule,
    ChannelAccountsModule,
    CatalogModule,
    ListingsModule,
    OrdersModule,
    InventoryModule,
    AnalyticsModule,
    WalletModule,
    MessagingModule,
    AutoloadModule,
    ReviewsModule,
    SyncModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
