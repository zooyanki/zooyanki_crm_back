import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';
import { sleep } from '../utils/sleep.js';

const WINDOW_MS = 60_000;
/// Скрипт атомарный: иначе при нескольких воркерах счётчик разъезжается
/// и мы пробиваем лимит площадки.
const INCREMENT_WINDOW = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
  end
  return current
`;

/// Ограничитель скорости запросов к площадкам.
/// Лимиты у Авито индивидуальны для каждого метода, поэтому ключ —
/// пара «аккаунт + эндпоинт», а не один общий счётчик.
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(private readonly redis: RedisService) {}

  /// Ждёт свободного слота. Возвращает false, если не дождались за maxWaitMs —
  /// вызывающий код должен отложить задачу, а не пробивать лимит.
  async acquire(key: string, perMinute: number, maxWaitMs = 30_000): Promise<boolean> {
    const deadline = Date.now() + maxWaitMs;

    for (;;) {
      const now = Date.now();
      const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
      const redisKey = `ratelimit:${key}:${windowStart}`;

      const used = (await this.redis.eval(
        INCREMENT_WINDOW,
        1,
        redisKey,
        String(WINDOW_MS),
      )) as number;

      if (used <= perMinute) {
        return true;
      }

      const waitMs = windowStart + WINDOW_MS - now;
      if (now + waitMs > deadline) {
        this.logger.warn(`Лимит ${key} не освободился за ${maxWaitMs} мс, откладываем`);
        return false;
      }

      await sleep(waitMs);
    }
  }

  /// Площадка сообщает остаток в заголовках ответа. Если он исчерпан,
  /// добиваем локальный счётчик до лимита, чтобы не отправлять заведомо
  /// отбиваемые запросы до конца окна.
  async applyServerHint(key: string, limit: number, remaining: number): Promise<void> {
    if (remaining > 0) {
      return;
    }

    const windowStart = Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS;
    const redisKey = `ratelimit:${key}:${windowStart}`;

    await this.redis.set(redisKey, String(limit + 1), 'PX', WINDOW_MS);
  }
}
