import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.schema.js';

/// Типизированный доступ к конфигурации. Вместо строковых ключей
/// по всему коду — именованные свойства.
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.get('PORT');
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.get('REDIS_URL');
  }

  get encryptionKey(): Buffer {
    return Buffer.from(this.get('ENCRYPTION_KEY'), 'hex');
  }

  get avitoApiBaseUrl(): string {
    return this.get('AVITO_API_BASE_URL');
  }

  get publicBaseUrl(): string {
    return this.get('PUBLIC_BASE_URL');
  }
}
