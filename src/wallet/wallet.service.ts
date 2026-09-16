import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ChannelRegistry } from '../channels/channel.registry.js';
import { ChannelAccountsService } from '../integrations/channel-accounts/channel-accounts.service.js';

export interface WalletBalanceView {
  channelAccountId: string;
  real: number;
  bonus: number;
}

export interface WalletOperationView {
  amountBonus: number;
  amountRub: number;
  amountTotal: number;
  itemId: string | null;
  operationName: string;
  operationType: string;
  serviceName: string | null;
  serviceType: string | null;
  updatedAt: string;
}

export interface WalletOperationsResult {
  channelAccountId: string;
  from: string;
  to: string;
  items: WalletOperationView[];
}

@Injectable()
export class WalletService {
  constructor(
    private readonly accounts: ChannelAccountsService,
    private readonly registry: ChannelRegistry,
  ) {}

  async balance(tenantId: string, channelAccountId: string): Promise<WalletBalanceView> {
    const { account, adapter } = await this.requireWallet(tenantId, channelAccountId);
    const balance = await adapter.wallet!.getBalance({
      tenantId,
      channelAccountId: account.id,
    });

    return {
      channelAccountId: account.id,
      real: balance.real,
      bonus: balance.bonus,
    };
  }

  async operations(
    tenantId: string,
    channelAccountId: string,
    from: Date,
    to: Date,
  ): Promise<WalletOperationsResult> {
    if (from >= to) {
      throw new BadRequestException('dateFrom должен быть раньше dateTo');
    }

    const maxMs = 7 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxMs) {
      throw new BadRequestException('Интервал истории операций не больше 7 дней');
    }

    const { account, adapter } = await this.requireWallet(tenantId, channelAccountId);
    const items = await adapter.wallet!.getOperationsHistory(
      { tenantId, channelAccountId: account.id },
      from,
      to,
    );

    return {
      channelAccountId: account.id,
      from: from.toISOString(),
      to: to.toISOString(),
      items,
    };
  }

  private async requireWallet(tenantId: string, channelAccountId: string) {
    const account = await this.accounts.requireForTenant(tenantId, channelAccountId);
    const adapter = this.registry.get(account.channel);

    if (!adapter.wallet) {
      throw new NotFoundException('У этой площадки нет кошелька в CRM');
    }

    return { account, adapter };
  }
}

