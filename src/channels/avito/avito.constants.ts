/// Лимиты запросов в минуту по эндпоинтам Авито.
/// Значения взяты из описаний методов в спецификации; там, где площадка
/// лимит не документирует, стоит консервативная оценка, а фактический
/// остаток дочитывается из заголовка X-RateLimit-Remaining.
export const AVITO_RATE_LIMITS = {
  token: 30,
  accountSelf: 60,
  /// Документировано: не более 25 запросов в минуту.
  items: 25,
  /// Для v1 лимит не указан; у аналогичного метода v2 он равен одному
  /// запросу в минуту, поэтому держимся низкого значения.
  itemStats: 5,
  /// Документировано: 1 запрос в минуту.
  spendings: 1,
  /// Документировано: до 500 запросов в минуту.
  orders: 100,
  /// Документировано: не более 100 запросов в минуту.
  applyTransition: 100,
  setTrackingNumber: 100,
  acceptReturnOrder: 100,
  orderLabels: 1000,
  orderLabelsDownload: 1000,
  markings: 100,
  getCourierDeliveryRange: 100,
  setCourierDeliveryRange: 100,
  cncSetDetails: 60,
  chats: 100,
  chatMessages: 200,
  sendMessage: 200,
  sendImageMessage: 100,
  uploadImages: 30,
  chatRead: 200,
  webhook: 10,
  autoloadUpload: 5,
  autoloadReports: 30,
  autoloadItems: 30,
  autoloadIds: 30,
  reviews: 60,
  reviewAnswers: 30,
  /// Документировано: не более 100 запросов в минуту, до 200 позиций.
  stocks: 100,
  /// Документировано: не более 150 запросов в минуту.
  updatePrice: 150,
  vasPrices: 60,
  applyVas: 60,
  balance: 60,
  operationsHistory: 30,
} as const;

export const AVITO_ENDPOINTS = {
  token: '/token',
  accountSelf: '/core/v1/accounts/self',
  items: '/core/v1/items',
  /// Счётчики по списку объявлений: принимает itemIds и отдаёт метрики
  /// по каждому объявлению за день. Метод v2 группирует иначе и
  /// пообъявленческой разбивки по дням не даёт.
  itemStats: '/stats/v1/accounts/{user_id}/items',
  spendings: '/stats/v2/accounts/{user_id}/spendings',
  orders: '/order-management/1/orders',
  applyTransition: '/order-management/1/order/applyTransition',
  setTrackingNumber: '/order-management/1/order/setTrackingNumber',
  acceptReturnOrder: '/order-management/1/order/acceptReturnOrder',
  orderLabels: '/order-management/1/orders/labels',
  orderLabelsDownload: '/order-management/1/orders/labels/{taskID}/download',
  markings: '/order-management/1/markings',
  getCourierDeliveryRange: '/order-management/1/order/getCourierDeliveryRange',
  setCourierDeliveryRange: '/order-management/1/order/setCourierDeliveryRange',
  cncSetDetails: '/order-management/1/order/cncSetDetails',
  chats: '/messenger/v2/accounts/{user_id}/chats',
  chatById: '/messenger/v2/accounts/{user_id}/chats/{chat_id}',
  chatMessages: '/messenger/v3/accounts/{user_id}/chats/{chat_id}/messages/',
  sendMessage: '/messenger/v1/accounts/{user_id}/chats/{chat_id}/messages',
  sendImageMessage: '/messenger/v1/accounts/{user_id}/chats/{chat_id}/messages/image',
  uploadImages: '/messenger/v1/accounts/{user_id}/uploadImages',
  chatRead: '/messenger/v1/accounts/{user_id}/chats/{chat_id}/read',
  webhookSubscribe: '/messenger/v3/webhook',
  webhookUnsubscribe: '/messenger/v1/webhook/unsubscribe',
  autoloadUpload: '/autoload/v1/upload',
  autoloadLastReport: '/autoload/v3/reports/last_completed_report',
  autoloadReportItems: '/autoload/v2/reports/{report_id}/items',
  autoloadAvitoIds: '/autoload/v2/items/avito_ids',
  reviews: '/ratings/v1/reviews',
  reviewAnswers: '/ratings/v1/answers',
  reviewAnswerById: '/ratings/v1/answers/{answer_id}',
  stocks: '/stock-management/1/stocks',
  stocksInfo: '/stock-management/1/info',
  updatePrice: '/core/v1/items/{item_id}/update_price',
  vasPrices: '/core/v1/accounts/{userId}/vas/prices',
  applyVas: '/core/v2/items/{itemId}/vas/',
  balance: '/core/v1/accounts/{user_id}/balance/',
  operationsHistory: '/core/v1/accounts/operations_history/',
} as const;

/// Авито отдаёт не больше 100 объявлений на страницу.
export const AVITO_ITEMS_PAGE_SIZE = 100;

/// По умолчанию метод возвращает только активные объявления, поэтому
/// статусы перечисляем явно — иначе снятые и заблокированные пропадут
/// из CRM, хотя пользователю они нужны.
export const AVITO_ITEM_STATUSES = 'active,removed,old,blocked,rejected';

/// Ограничение метода статистики: не более 200 объявлений в одном запросе.
export const AVITO_STATS_BATCH_SIZE = 200;

/// Ограничение глубины выборки статистики — 270 дней.
export const AVITO_STATS_MAX_DAYS = 270;

/// Максимум позиций в одном PUT /stocks.
export const AVITO_STOCKS_BATCH_SIZE = 200;

/// Жёсткий лимит POST /stock-management/1/info по description (не schema).
export const AVITO_STOCKS_INFO_BATCH_SIZE = 10;
