/// Ошибка обращения к площадке. Наружу пользователю не отдаётся как есть:
/// в теле может быть текст площадки, непонятный оператору CRM.
export class ChannelHttpError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly endpoint: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ChannelHttpError';
  }

  /// Повторная попытка имеет смысл: лимит, сбой сети или пятисотка.
  get isRetryable(): boolean {
    return this.status === null || this.status === 429 || this.status >= 500;
  }

  /// Учётные данные больше не работают — аккаунт надо пометить как невалидный.
  get isAuthFailure(): boolean {
    return this.status === 401 || this.status === 403;
  }
}
