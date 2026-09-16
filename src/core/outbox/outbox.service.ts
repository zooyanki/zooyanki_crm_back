import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../generated/prisma/client.js';
import { OutboxStatus } from '../../generated/prisma/enums.js';
import type { TransactionClient } from '../db/prisma.service.js';
import { PrismaService } from '../db/prisma.service.js';

export interface EnqueueOutboxInput {
  tenantId: string;
  channelAccountId?: string | null;
  type: string;
  payload: Prisma.InputJsonValue;
  idempotencyKey: string;
  availableAt?: Date;
}

export interface ClaimedOutboxMessage {
  id: string;
  tenantId: string;
  channelAccountId: string | null;
  type: string;
  payload: Prisma.JsonValue;
  idempotencyKey: string;
  attempts: number;
}

/// Исходящие команды: постановка в той же транзакции, что и доменные
/// изменения; воркер забирает пачками и вызывает адаптер площадки.
@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: EnqueueOutboxInput): Promise<void> {
    await this.prisma.withTenant(input.tenantId, (tx) => this.enqueueInTx(tx, input));
  }

  async enqueueInTx(tx: TransactionClient, input: EnqueueOutboxInput): Promise<void> {
    await tx.outboxMessage.upsert({
      where: {
        tenantId_idempotencyKey: {
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      create: {
        tenantId: input.tenantId,
        channelAccountId: input.channelAccountId ?? null,
        type: input.type,
        payload: input.payload,
        idempotencyKey: input.idempotencyKey,
        availableAt: input.availableAt ?? new Date(),
      },
      update: {
        // Повтор с тем же ключом — no-op: защита от дублей.
      },
    });
  }

  /// Забирает готовые сообщения без арендаторского контекста:
  /// планировщик обходит всех арендаторов (как listActiveForSync).
  /// Под суперпользователем Postgres RLS обходится; для обычного роли
  /// понадобится отдельный bypass — пока локально достаточно.
  async claimPending(limit = 20): Promise<ClaimedOutboxMessage[]> {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ClaimedOutboxMessage[]>`
        UPDATE outbox AS o
        SET
          status = 'PROCESSING'::outbox_status,
          attempts = o.attempts + 1,
          "updatedAt" = NOW()
        FROM (
          SELECT id
          FROM outbox
          WHERE status = 'PENDING'::outbox_status
            AND "availableAt" <= ${now}
          ORDER BY "availableAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        ) AS picked
        WHERE o.id = picked.id
        RETURNING
          o.id,
          o."tenantId",
          o."channelAccountId",
          o.type,
          o.payload,
          o."idempotencyKey",
          o.attempts
      `;

      return rows;
    });
  }

  async markDone(tenantId: string, id: string): Promise<void> {
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.outboxMessage.update({
        where: { id },
        data: {
          status: OutboxStatus.DONE,
          processedAt: new Date(),
          lastError: null,
        },
      }),
    );
  }

  async markFailed(
    tenantId: string,
    id: string,
    error: string,
    options: { retry: boolean; delayMs: number },
  ): Promise<void> {
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.outboxMessage.update({
        where: { id },
        data: {
          status: options.retry ? OutboxStatus.PENDING : OutboxStatus.FAILED,
          lastError: error.slice(0, 2000),
          availableAt: options.retry
            ? new Date(Date.now() + options.delayMs)
            : new Date(),
          processedAt: options.retry ? null : new Date(),
        },
      }),
    );
  }
}
