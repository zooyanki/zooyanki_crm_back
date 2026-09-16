import { Injectable } from '@nestjs/common';

import type {
  WalletBalance,
  WalletOperation,
  WalletReader,
} from '../../contracts/channel-adapter.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import { AVITO_ENDPOINTS, AVITO_RATE_LIMITS } from '../avito.constants.js';
import { AvitoCredentialsService } from '../auth/avito-credentials.service.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type {
  AvitoBalanceResponse,
  AvitoOperationsHistoryRequest,
  AvitoOperationsHistoryResponse,
} from '../client/avito-api.types.js';

@Injectable()
export class AvitoWalletService implements WalletReader {
  constructor(
    private readonly api: AvitoApiClient,
    private readonly credentials: AvitoCredentialsService,
  ) {}

  async getBalance(ctx: ChannelContext): Promise<WalletBalance> {
    const userId = await this.credentials.externalUserId(ctx);
    const path = AVITO_ENDPOINTS.balance.replace('{user_id}', userId);

    const response = await this.api.request<AvitoBalanceResponse>(ctx, {
      method: 'GET',
      path,
      endpoint: AVITO_ENDPOINTS.balance,
      rateLimitPerMinute: AVITO_RATE_LIMITS.balance,
    });

    return {
      real: Number(response.real ?? 0),
      bonus: Number(response.bonus ?? 0),
    };
  }

  async getOperationsHistory(
    ctx: ChannelContext,
    from: Date,
    to: Date,
  ): Promise<WalletOperation[]> {
    const body: AvitoOperationsHistoryRequest = {
      dateTimeFrom: formatDateTime(from),
      dateTimeTo: formatDateTime(to),
    };

    const response = await this.api.request<AvitoOperationsHistoryResponse>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.operationsHistory,
      endpoint: AVITO_ENDPOINTS.operationsHistory,
      json: body,
      rateLimitPerMinute: AVITO_RATE_LIMITS.operationsHistory,
    });

    const rows = response.result?.operations ?? response.operations ?? [];
    return rows.map((row) => ({
      amountBonus: Number(row.amountBonus ?? 0),
      amountRub: Number(row.amountRub ?? 0),
      amountTotal: Number(row.amountTotal ?? 0),
      itemId: row.itemId == null ? null : String(row.itemId),
      operationName: row.operationName ?? 'Операция',
      operationType: row.operationType ?? '',
      serviceName: row.serviceName ?? null,
      serviceType: row.serviceType ?? null,
      updatedAt: row.updatedAt ?? from.toISOString(),
    }));
  }
}

function formatDateTime(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
    `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  );
}

