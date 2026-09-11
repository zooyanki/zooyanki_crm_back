import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../db/prisma.service.js';
import type { ChannelCode } from '../../generated/prisma/enums.js';

const SNIPPET_LIMIT = 2000;
const SECRET_KEYS = ['client_secret', 'clientSecret', 'access_token', 'refresh_token', 'password'];

export interface ApiCallLogEntry {
  channel: ChannelCode;
  tenantId?: string | null;
  channelAccountId?: string | null;
  method: string;
  endpoint: string;
  statusCode: number | null;
  durationMs: number;
  ok: boolean;
  errorCode?: string | null;
  errorText?: string | null;
  request?: unknown;
  response?: unknown;
}

/// Журнал вызовов к площадкам. Без него отладка XML-фидов автозагрузки
/// и разбор отказов площадки превращаются в гадание.
@Injectable()
export class ApiCallLogService {
  private readonly logger = new Logger(ApiCallLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /// Ошибки записи журнала не должны ронять сам запрос.
  record(entry: ApiCallLogEntry): void {
    void this.prisma.apiCallLog
      .create({
        data: {
          channel: entry.channel,
          tenantId: entry.tenantId ?? null,
          channelAccountId: entry.channelAccountId ?? null,
          method: entry.method,
          endpoint: entry.endpoint,
          statusCode: entry.statusCode,
          durationMs: entry.durationMs,
          ok: entry.ok,
          errorCode: entry.errorCode ?? null,
          errorText: truncate(entry.errorText ?? null),
          requestSnippet: snippet(entry.request),
          responseSnippet: snippet(entry.response),
        },
      })
      .catch((error: unknown) => {
        this.logger.warn(`Не удалось записать вызов ${entry.endpoint} в журнал: ${String(error)}`);
      });
  }
}

function snippet(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const text = typeof value === 'string' ? value : safeStringify(value);
  return truncate(redact(text));
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[не сериализуется]';
  }
}

/// Грубая, но надёжная маскировка: секрет не должен попасть в базу
/// даже если его случайно передали в теле запроса.
function redact(text: string): string {
  return SECRET_KEYS.reduce(
    (acc, key) =>
      acc.replace(new RegExp(`("${key}"\\s*:\\s*")[^"]*(")`, 'gi'), '$1***$2'),
    text,
  );
}

function truncate(text: string | null): string | null {
  if (text === null) {
    return null;
  }

  return text.length > SNIPPET_LIMIT ? `${text.slice(0, SNIPPET_LIMIT)}…` : text;
}
