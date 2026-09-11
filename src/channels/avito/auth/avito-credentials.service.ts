import { Injectable, NotFoundException } from '@nestjs/common';

import { CryptoService } from '../../../core/crypto/crypto.service.js';
import { PrismaService } from '../../../core/db/prisma.service.js';
import type { ChannelContext } from '../../contracts/channel-context.js';

export interface AvitoCredentials {
  clientId: string;
  clientSecret: string;
}

@Injectable()
export class AvitoCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async load(ctx: ChannelContext): Promise<AvitoCredentials> {
    const account = await this.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.channelAccount.findUnique({ where: { id: ctx.channelAccountId } }),
    );

    if (!account) {
      throw new NotFoundException(`Аккаунт площадки ${ctx.channelAccountId} не найден`);
    }

    return this.crypto.decryptJson<AvitoCredentials>(account.credentialsEncrypted);
  }

  /// Идентификатор пользователя на стороне Авито. Нужен для эндпоинтов
  /// статистики и мессенджера, которые принимают его в пути.
  async externalUserId(ctx: ChannelContext): Promise<string> {
    const account = await this.prisma.withTenant(ctx.tenantId, (tx) =>
      tx.channelAccount.findUnique({
        where: { id: ctx.channelAccountId },
        select: { externalUserId: true },
      }),
    );

    if (!account?.externalUserId) {
      throw new NotFoundException(
        'Для аккаунта не сохранён идентификатор пользователя Авито — выполните проверку подключения',
      );
    }

    return account.externalUserId;
  }
}
