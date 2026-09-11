import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  REDIS_URL: z.string().min(1, 'REDIS_URL обязателен'),

  /// 32 байта в hex. Генерация:
  /// node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY должен быть 32 байта в hex (64 символа)'),

  AVITO_API_BASE_URL: z.string().min(1).default('https://api.avito.ru'),

  /// Публичный адрес сервиса. Обязателен только для вебхука мессенджера
  /// и XML-фида автозагрузки, поэтому на старте может быть пустым.
  PUBLIC_BASE_URL: z.string().default(''),

  /// Секрет подписи JWT. Генерация та же, что у ENCRYPTION_KEY.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET должен быть не короче 32 символов'),

  /// Срок жизни access-токена, например 7d или 12h.
  JWT_EXPIRES_IN: z.string().default('7d'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Некорректные переменные окружения:\n${details}`);
  }

  return result.data;
}
