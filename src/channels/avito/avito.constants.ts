/// Лимиты запросов в минуту по эндпоинтам Авито.
/// Точное значение документировано только для update_price; для остальных
/// держим консервативную оценку и корректируем по заголовкам
/// X-RateLimit-Remaining, которые площадка возвращает в ответе.
export const AVITO_RATE_LIMITS = {
  token: 30,
  accountSelf: 60,
  items: 60,
  itemStats: 30,
  updatePrice: 150,
} as const;

export const AVITO_ENDPOINTS = {
  token: '/token',
  accountSelf: '/core/v1/accounts/self',
  items: '/core/v1/items',
  itemStats: '/stats/v2/accounts/{user_id}/items',
  spendings: '/stats/v2/accounts/{user_id}/spendings',
} as const;

/// Авито отдаёт не больше 100 объявлений на страницу.
export const AVITO_ITEMS_PAGE_SIZE = 100;

/// Ограничение метода статистики на количество объявлений в одном запросе.
export const AVITO_STATS_BATCH_SIZE = 200;
