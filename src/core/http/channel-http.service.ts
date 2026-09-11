import { Injectable, Logger } from '@nestjs/common';

import type { ChannelCode } from '../../generated/prisma/enums.js';
import { sleep } from '../utils/sleep.js';
import { ApiCallLogService } from './api-call-log.service.js';
import { ChannelHttpError } from './channel-http.error.js';
import { RateLimiterService } from './rate-limiter.service.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ChannelRequest {
  channel: ChannelCode;
  method: HttpMethod;
  url: string;
  /// Шаблон пути без подставленных идентификаторов: '/core/v1/items'.
  /// Используется как ключ лимитера и как поле журнала, поэтому
  /// подставлять сюда конкретные id нельзя — счётчики разъедутся.
  endpoint: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  json?: unknown;
  form?: Record<string, string>;
  accessToken?: string;
  /// Лимит запросов в минуту для этого метода.
  rateLimitPerMinute?: number;
  /// Сколько ждать освобождения слота. У методов с жёстким лимитом
  /// стоит увеличить, иначе пачка запросов будет отваливаться по таймауту.
  rateLimitMaxWaitMs?: number;
  tenantId?: string | null;
  channelAccountId?: string | null;
  maxAttempts?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;

/// Единая точка выхода во внешние API площадок: ограничение скорости,
/// повторные попытки и журналирование. Прямые вызовы fetch из адаптеров
/// запрещены — иначе лимиты и журнал перестают работать.
@Injectable()
export class ChannelHttpService {
  private readonly logger = new Logger(ChannelHttpService.name);

  constructor(
    private readonly rateLimiter: RateLimiterService,
    private readonly callLog: ApiCallLogService,
  ) {}

  async request<T>(req: ChannelRequest): Promise<T> {
    const maxAttempts = req.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const limitKey = `${req.channelAccountId ?? 'anonymous'}:${req.method} ${req.endpoint}`;
    const perMinute = req.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE;

    let lastError: ChannelHttpError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const acquired = await this.rateLimiter.acquire(
        limitKey,
        perMinute,
        req.rateLimitMaxWaitMs,
      );
      if (!acquired) {
        throw new ChannelHttpError(
          `Лимит запросов ${req.endpoint} исчерпан, попробуйте позже`,
          429,
          req.endpoint,
        );
      }

      try {
        return await this.attempt<T>(req, limitKey);
      } catch (error) {
        if (!(error instanceof ChannelHttpError) || !error.isRetryable) {
          throw error;
        }

        lastError = error;

        if (attempt === maxAttempts) {
          break;
        }

        const delayMs = backoffDelay(attempt);
        this.logger.warn(
          `${req.method} ${req.endpoint} — попытка ${attempt} из ${maxAttempts} неудачна ` +
            `(${error.status ?? 'сеть'}), повтор через ${delayMs} мс`,
        );
        await sleep(delayMs);
      }
    }

    throw lastError ?? new ChannelHttpError('Запрос не выполнен', null, req.endpoint);
  }

  private async attempt<T>(req: ChannelRequest, limitKey: string): Promise<T> {
    const url = buildUrl(req.url, req.query);
    const startedAt = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), req.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: req.method,
        headers: buildHeaders(req),
        body: buildBody(req),
        signal: controller.signal,
      });

      const payload = await parseBody(response);
      const durationMs = Date.now() - startedAt;

      await this.applyRateLimitHeaders(response, limitKey);

      this.callLog.record({
        channel: req.channel,
        tenantId: req.tenantId,
        channelAccountId: req.channelAccountId,
        method: req.method,
        endpoint: req.endpoint,
        statusCode: response.status,
        durationMs,
        ok: response.ok,
        errorText: response.ok ? null : String(response.statusText),
        request: req.json ?? req.form,
        response: payload,
      });

      if (!response.ok) {
        throw new ChannelHttpError(
          `${req.method} ${req.endpoint} вернул ${response.status}`,
          response.status,
          req.endpoint,
          payload,
        );
      }

      return payload as T;
    } catch (error) {
      if (error instanceof ChannelHttpError) {
        throw error;
      }

      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);

      this.callLog.record({
        channel: req.channel,
        tenantId: req.tenantId,
        channelAccountId: req.channelAccountId,
        method: req.method,
        endpoint: req.endpoint,
        statusCode: null,
        durationMs,
        ok: false,
        errorCode: 'NETWORK',
        errorText: message,
        request: req.json ?? req.form,
      });

      throw new ChannelHttpError(
        `${req.method} ${req.endpoint}: ${message}`,
        null,
        req.endpoint,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async applyRateLimitHeaders(response: Response, limitKey: string): Promise<void> {
    const limit = Number(response.headers.get('x-ratelimit-limit'));
    const remaining = Number(response.headers.get('x-ratelimit-remaining'));

    if (Number.isFinite(limit) && Number.isFinite(remaining)) {
      await this.rateLimiter.applyServerHint(limitKey, limit, remaining);
    }
  }
}

function buildUrl(
  base: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!query) {
    return base;
  }

  const url = new URL(base);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function buildHeaders(req: ChannelRequest): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json', ...req.headers };

  if (req.accessToken) {
    headers.Authorization = `Bearer ${req.accessToken}`;
  }

  if (req.json !== undefined) {
    headers['Content-Type'] = 'application/json';
  } else if (req.form !== undefined) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  return headers;
}

function buildBody(req: ChannelRequest): string | undefined {
  if (req.json !== undefined) {
    return JSON.stringify(req.json);
  }

  if (req.form !== undefined) {
    return new URLSearchParams(req.form).toString();
  }

  return undefined;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) {
    return text;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/// Экспоненциальная задержка с джиттером: без разброса несколько воркеров
/// синхронно повторяют запросы и снова упираются в лимит.
function backoffDelay(attempt: number): number {
  const base = 1000 * 2 ** (attempt - 1);
  return base + Math.floor(Math.random() * 500);
}
