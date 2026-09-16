import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { CryptoService } from '../../core/crypto/crypto.service.js';
import { PrismaService } from '../../core/db/prisma.service.js';
import { ChannelHttpError } from '../../core/http/channel-http.error.js';
import { ChannelRegistry } from '../../channels/channel.registry.js';
import { isEnabledChannel } from '../../channels/enabled-channels.js';
import { ChannelAccountStatus, type ChannelCode } from '../../generated/prisma/enums.js';

export interface ChannelAccountView {
  id: string;
  channel: ChannelCode;
  title: string;
  status: ChannelAccountStatus;
  externalUserId: string | null;
  lastError: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
}

export interface ConnectChannelAccountInput {
  channel: ChannelCode;
  title: string;
  clientId: string;
  clientSecret: string;
}

@Injectable()
export class ChannelAccountsService {
  private readonly logger = new Logger(ChannelAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly registry: ChannelRegistry,
  ) {}

  async connect(tenantId: string, input: ConnectChannelAccountInput): Promise<ChannelAccountView> {
    if (!isEnabledChannel(input.channel)) {
      throw new BadRequestException('Эту площадку сейчас нельзя подключить');
    }
    if (!this.registry.has(input.channel)) {
      throw new BadRequestException('Интеграция площадки ещё в разработке');
    }

    const account = await this.prisma.withTenant(tenantId, (tx) =>
      tx.channelAccount.create({
        data: {
          tenantId,
          channel: input.channel,
          title: input.title,
          credentialsEncrypted: this.crypto.encryptJson({
            clientId: input.clientId,
            clientSecret: input.clientSecret,
          }),
          status: ChannelAccountStatus.PENDING,
        },
      }),
    );

    // Сразу проверяем: пользователю нужно узнать об опечатке в ключах
    // здесь, а не через сутки по пустой синхронизации.
    return this.verify(tenantId, account.id);
  }

  async list(tenantId: string): Promise<ChannelAccountView[]> {
    const accounts = await this.prisma.withTenant(tenantId, (tx) =>
      tx.channelAccount.findMany({ orderBy: { createdAt: 'asc' } }),
    );

    return accounts.map(toView);
  }

  async verify(tenantId: string, channelAccountId: string): Promise<ChannelAccountView> {
    const account = await this.requireAccount(tenantId, channelAccountId);
    const adapter = this.registry.get(account.channel);

    try {
      const identity = await adapter.auth.verify({ tenantId, channelAccountId });

      const updated = await this.prisma.withTenant(tenantId, (tx) =>
        tx.channelAccount.update({
          where: { id: channelAccountId },
          data: {
            externalUserId: identity.externalUserId,
            status: ChannelAccountStatus.ACTIVE,
            lastError: null,
          },
        }),
      );

      return toView(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const invalidCredentials = error instanceof ChannelHttpError && error.isAuthFailure;

      this.logger.warn(`Проверка аккаунта ${channelAccountId} не прошла: ${message}`);

      const updated = await this.prisma.withTenant(tenantId, (tx) =>
        tx.channelAccount.update({
          where: { id: channelAccountId },
          data: {
            status: invalidCredentials
              ? ChannelAccountStatus.INVALID_CREDENTIALS
              : ChannelAccountStatus.PENDING,
            lastError: message,
          },
        }),
      );

      return toView(updated);
    }
  }

  /// Активные аккаунты одной площадки по всем арендаторам —
  /// нужно планировщику, который обходит их без контекста запроса.
  async listActiveForSync(channel: ChannelCode): Promise<Array<{ tenantId: string; id: string }>> {
    return this.prisma.channelAccount.findMany({
      where: { channel, status: ChannelAccountStatus.ACTIVE },
      select: { id: true, tenantId: true },
    });
  }

  /// Поиск аккаунта для входящего вебхука (без HTTP-контекста арендатора).
  async findActiveById(channelAccountId: string): Promise<{
    id: string;
    tenantId: string;
    channel: ChannelCode;
    externalUserId: string | null;
  } | null> {
    return this.prisma.channelAccount.findFirst({
      where: { id: channelAccountId, status: ChannelAccountStatus.ACTIVE },
      select: { id: true, tenantId: true, channel: true, externalUserId: true },
    });
  }

  private async requireAccount(tenantId: string, channelAccountId: string) {
    const account = await this.prisma.withTenant(tenantId, (tx) =>
      tx.channelAccount.findUnique({ where: { id: channelAccountId } }),
    );

    if (!account) {
      throw new NotFoundException(`Аккаунт ${channelAccountId} не найден`);
    }

    return account;
  }

  /// Публичный доступ для воркеров outbox/sync без HTTP-контекста.
  async requireForTenant(tenantId: string, channelAccountId: string) {
    return this.requireAccount(tenantId, channelAccountId);
  }
}

function toView(account: {
  id: string;
  channel: ChannelCode;
  title: string;
  status: ChannelAccountStatus;
  externalUserId: string | null;
  lastError: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
}): ChannelAccountView {
  return {
    id: account.id,
    channel: account.channel,
    title: account.title,
    status: account.status,
    externalUserId: account.externalUserId,
    lastError: account.lastError,
    lastSyncAt: account.lastSyncAt,
    createdAt: account.createdAt,
  };
}
