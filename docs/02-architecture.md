# Архитектура бэкенда

## Главный принцип

Специфика площадки не просачивается в бизнес-логику. Ядро знает только
канонические модели и интерфейсы; всё, что знает про Авито, заперто
в `src/channels/avito/`.

```
Домен (catalog, inventory, orders, ...)
        |  канонические модели
        v
ChannelRegistry  ->  ChannelAdapter (интерфейсы из channels/contracts)
                          |
              +-----------+-----------+
              |           |           |
           avito        ozon         wb        (папки-адаптеры)
```

## Структура каталогов

```
src/
  core/
    config/        # env через zod, типизированный ConfigService
    db/            # PrismaService, транзакции, контекст tenant для RLS
    queue/         # BullMQ: очереди, воркеры, расписания
    crypto/        # шифрование секретов площадок (AES-256-GCM)
    http/          # базовый клиент: retry, backoff, rate limiter, лог вызовов
    outbox/        # исходящие команды с idempotency-ключами
  tenancy/         # Tenant, User, Membership, guard и контекст tenantId
  catalog/         # Product, Variant — наш каталог, источник истины
  inventory/       # остатки, движения, резервы
  orders/          # канонические заказы и их статусы
  messaging/       # канонические диалоги (фаза 4)
  reviews/         # отзывы (фаза 5)
  analytics/       # агрегаты: показы, контакты, продажи, расходы
  channels/
    contracts/     # интерфейсы адаптеров + канонические DTO
    registry.ts    # ChannelRegistry: code -> adapter
    avito/
      auth/        # токен-сервис, OAuth-коллбэк, кеш токенов
      client/      # сгенерированный из OpenAPI клиент + враппер
      listings/    # /core/v1/items, карточка, update_price
      stats/       # /stats/v2/...
      orders/      # /order-management/1/...
      stocks/      # /stock-management/1/...
      messenger/   # /messenger v1-v3 + вебхук
      autoload/    # генерация XML-фида и разбор отчётов
      mappers/     # Avito DTO <-> канонические модели
      sync/        # BullMQ-джобы опроса
```

## Контракты адаптеров

Интерфейс намеренно разбит на узкие возможности: площадки умеют разное,
и адаптер объявляет только то, что действительно поддерживает. Бизнес-логика
проверяет наличие возможности, а не ловит `NotImplementedError`.

```ts
interface ChannelAdapter {
  readonly code: ChannelCode;
  readonly capabilities: ReadonlySet<Capability>;
  auth: ChannelAuth;
  listings?: ListingReader & Partial<PriceWriter>;
  stocks?: StockWriter;
  orders?: OrderReader & Partial<OrderTransitioner>;
  messaging?: MessagingProvider;
  stats?: StatsReader;
  publishing?: ListingPublisher;
}
```

Пример расхождения: Авито не умеет создавать объявления через REST — только
через автозагрузку XML-фида. Поэтому `ListingPublisher` у него реализован
асинхронно (поставить в фид, дождаться отчёта), тогда как у Ozon это будет
прямой синхронный вызов. Контракт описывает намерение («опубликовать вариант»),
а не способ.

## Синхронизация

Вебхуки есть только у мессенджера Авито. Всё остальное — опрос по расписанию
через BullMQ repeatable jobs:

| Джоба | Интервал | Источник |
|---|---|---|
| `avito.orders.poll` | 2–5 мин | `/order-management/1/orders` |
| `avito.listings.sync` | 30 мин | `/core/v1/items` |
| `avito.stats.daily` | 1 раз в сутки ночью | `/stats/v2/...` |
| `avito.reviews.poll` | 1 час | `/ratings/v1/reviews` |
| `avito.autoload.report` | после каждой выгрузки | `/autoload/v4/uploads/current` |

Каждая джоба хранит курсор синхронизации в `sync_states`, чтобы после сбоя
не начинать с нуля и не упираться в лимиты.

## Исходящие операции

Любое изменение на стороне площадки — цена, остаток, статус заказа, сообщение —
проходит через outbox:

1. Домен пишет команду в таблицу `outbox` в той же транзакции, что и изменение
   своих данных.
2. Воркер забирает команду, вызывает адаптер, фиксирует результат.
3. Idempotency-ключ гарантирует, что ретрай не отправит сообщение дважды
   и не поднимет цену два раза.

## Ограничение скорости

У Авито лимиты индивидуальны для каждого метода и возвращаются в заголовках
`X-RateLimit-Limit` и `X-RateLimit-Remaining`. Базовый HTTP-клиент держит
token bucket в Redis в разрезе `(channel_account_id, endpoint)`, читает
остаток из заголовков ответа и уходит в экспоненциальный backoff на 429.
Без этого при нескольких подключённых аккаунтах интеграция встанет.

## Наблюдаемость

Каждый вызов к площадке пишется в `api_call_log`: метод, статус, длительность,
идентификатор аккаунта, сокращённые тело запроса и ответа с вырезанными
секретами. При отладке XML-фидов автозагрузки без этого журнала не обойтись.
