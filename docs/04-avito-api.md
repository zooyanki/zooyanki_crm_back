# API Авито: карта и ограничения

Источник: [каталог API Авито](https://developers.avito.ru/api-catalog).
Это не один сервис, а около полусотни отдельных OpenAPI 3.0 спецификаций
на общем хосте `https://api.avito.ru`.

## Авторизация

Два механизма OAuth 2.0, оба получают токен на `POST https://api.avito.ru/token`.

**Персональная — `client_credentials`.** `client_id` и `client_secret` своего
аккаунта, доступ только к своим данным. Это режим фазы 1.

```
POST https://api.avito.ru/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=XXX&client_secret=YYY
```

Ответ: `{ "access_token": "...", "expires_in": 3600, "token_type": "Bearer" }`.
Токен живёт час, поэтому кеш обязателен — иначе выжжем лимиты на `/token`.

**Для приложений — `authorization_code`.** Редирект на `https://avito.ru/oauth`,
доступ к данным чужих аккаунтов. Понадобится, когда система начнёт обслуживать
клиентские аккаунты.

Ключи создаются в личном кабинете Авито в разделе профессиональных инструментов.

### Скоупы

```
items:info            items:apply_vas       autoload:reports
messenger:read        messenger:write       stats:read
user:read             user_balance:read     user_operations:read
ratings:read          ratings:write
job:write             job:cv                job:applications
short_term_rent:read  short_term_rent:write
ah:access             (иерархия аккаунтов, для authorization_code)
```

## Карта эндпоинтов

### Аккаунт и финансы
- `GET  /core/v1/accounts/self` — профиль, отсюда берём `user_id`
- `GET  /core/v1/accounts/{user_id}/balance/` — баланс
- `GET  /core/v1/accounts/operations_history/` — история операций
- `GET  /api/1/agency/finances/balance` — агентский баланс
- `GET  /api/1/agency/finances/transactionsHistory` — агентские транзакции

### Объявления
- `GET  /core/v1/items` — список объявлений. **Не более 25 запросов в минуту.**
  Параметры: `page`, `per_page` (максимум 100), `status`.
  Два подвоха: `status` по умолчанию равен `active`, поэтому все нужные
  статусы (`active,removed,old,blocked,rejected`) надо перечислять явно;
  в `meta` есть только `page` и `per_page`, **общего числа страниц нет** —
  конец списка определяется по неполной странице.
  В ответе нет даты публикации: только `id`, `title`, `price`, `status`,
  `url`, `address`, `category`.
- `GET  /core/v1/accounts/{user_id}/items/{item_id}/` — карточка
- `POST /core/v1/items/{item_id}/update_price` — цена, максимум 150 запросов
  в минуту, доступно не для всех категорий

### Продвижение
- `GET  /core/v1/accounts/{userId}/vas/prices` — цены услуг
- `PUT  /core/v2/items/{itemId}/vas/` — применить услугу к объявлению
- `/core/v2/accounts/{user_id}/items/{item_id}/vas_packages` — пакеты
- `GET  /core/v1/accounts/{user_id}/calls/stats/` — статистика звонков

### Заказы (Авито Доставка)
- `/order-management/1/orders` — список заказов
- `/order-management/1/order/applyTransition` — смена статуса
- `/order-management/1/order/setTrackingNumber` — трек-номер
- `/order-management/1/order/checkConfirmationCode` — код подтверждения
- `/order-management/1/order/acceptReturnOrder` — приём возврата
- `/order-management/1/order/getCourierDeliveryRange`
- `/order-management/1/order/setCourierDeliveryRange`
- `/order-management/1/order/cncSetDetails` — click-and-collect
- `/order-management/1/orders/labels`, `/labels/extended`,
  `/labels/{taskID}/download` — ярлыки
- `/order-management/1/markings` — маркировка

### Остатки
- `/stock-management/1/stocks` — установка остатков
- `POST /stock-management/1/info` — текущие остатки (до 10 id за запрос)

### Мессенджер
- `GET  /messenger/v2/accounts/{user_id}/chats` — список чатов
- `GET  /messenger/v2/accounts/{user_id}/chats/{chat_id}` — чат
- `GET  /messenger/v3/accounts/{user_id}/chats/{chat_id}/messages/` — сообщения
- `POST /messenger/v1/accounts/{user_id}/chats/{chat_id}/messages` — отправка
- `POST /messenger/v1/accounts/{user_id}/chats/{chat_id}/messages/image`
- `POST /messenger/v1/accounts/{user_id}/uploadImages`
- `POST /messenger/v1/accounts/{user_id}/chats/{chat_id}/read`
- `POST /messenger/v1/accounts/{user_id}/getVoiceFiles`
- `POST /messenger/v3/webhook` — подписка на вебхук
- `POST /messenger/v1/webhook/unsubscribe`
- `POST /messenger/v1/subscriptions` — список подписок
- `/messenger/v2/accounts/{user_id}/blacklist` — чёрный список

### Статистика

Версии решают разные задачи, и v2 не заменяет v1:

- `POST /stats/v1/accounts/{user_id}/items` — метрики **по каждому
  объявлению за каждый день**. Тело: `itemIds`, `dateFrom`, `dateTo`,
  `fields`, `periodGrouping`. Метрики: `uniqViews`, `uniqContacts`,
  `uniqFavorites` (варианты без префикса `uniq` устарели).
  Не более 200 объявлений в запросе, глубина до 270 дней.
  Ответ: `result.items[].{itemId, stats[].{date, uniqViews, ...}}`.
- `POST /stats/v2/accounts/{user_id}/items` — аналитика **по профилю**
  с одной группировкой на запрос (`totals`, `item`, `day`, `week`, `month`).
  Фильтрации по конкретным объявлениям нет, только по категориям
  и сотрудникам. Ответ: `result.groupings[].{id, metrics[].{slug, value}}`,
  где при группировке по датам `id` — unix-время. **Лимит: 1 запрос в минуту.**
- `POST /stats/v2/accounts/{user_id}/spendings` — расходы, глубина 270 дней,
  тоже 1 запрос в минуту.

Для пообъявленческой статистики нужен именно v1.

### Отзывы
- `GET  /ratings/v1/reviews` — отзывы
- `GET  /ratings/v1/info` — сводный рейтинг
- `POST /ratings/v1/answers` — ответ на отзыв
- `DELETE /ratings/v1/answers/{answer_id}` — удалить ответ

### Автозагрузка
- `POST /autoload/v1/upload` — запустить выгрузку фида
- `/autoload/v2/profile`, `/autoload/v1/profile` — настройки автозагрузки
- `/autoload/v4/uploads` — список выгрузок
- `/autoload/v4/uploads/current`, `/uploads/current/items` — текущая выгрузка
- `/autoload/v4/uploads/last_successful`, `/last_successful/items`
- `/autoload/v3/reports/{report_id}`, `/v3/reports/last_completed_report`
- `/autoload/v2/reports/{report_id}/items`, `/items/fees`
- `/autoload/v2/items/ad_ids`, `/autoload/v2/items/avito_ids` — связка ID
- `/autoload/v1/user-docs/tree`, `/user-docs/node/{node_slug}/fields` —
  справочник категорий и полей фида

### Прочие API каталога

Не нужны сейчас, но существуют: `auction`, `autostrategy`, `calltracking`,
`cpa`, `cpxpromo`, `delivery-sandbox`, `deliverytariffication`, `evaluation`,
`job`, `offlinemonitoring`, `parcelprocessing`, `profile`, `promotion`,
`realty`, `referencedata`, `report`, `risksassessment`, `signal`,
`specialoffers`, `targeting`, `tariff`, `teaser`, `terminalmanagement`,
`transactions`, `xdelivery`.

## Ограничения, определяющие архитектуру

**Публикация только через автозагрузку.** Создать или отредактировать
объявление через REST нельзя. Через API меняется лишь цена (`update_price`)
и применяется продвижение. Для всего остального CRM должна сгенерировать
XML-фид, выложить его по публичному HTTPS-адресу, вызвать `/autoload/v1/upload`
и затем опрашивать `/autoload/v4/uploads/current` и
`/autoload/v2/reports/{report_id}/items`, чтобы узнать результат по каждой
позиции. Отсюда обязательная связка `наш SKU <-> ad_id <-> avito_id`.

**Вебхуки только у мессенджера.** Заказы, остатки, статистика и отзывы —
только опрос по расписанию.

**Лимиты индивидуальны для каждого метода.** Возвращаются в заголовках
`X-RateLimit-Limit` и `X-RateLimit-Remaining`. Нужен token bucket
в разрезе «аккаунт + эндпоинт» и backoff на 429.

**Мессенджер платный.** С ноября 2025 чтение и отправка сообщений требуют
платной подписки на профинструменты.

**Заказы и остатки требуют Авито Доставки.** Без неё `order-management`
и `stock-management` недоступны.

**Публичный HTTPS обязателен** для XML-фида автозагрузки и для вебхука
мессенджера. Учесть при выборе хостинга.

## Генерация клиента

Авито публикует Swagger 3.0, поэтому клиент не пишется руками:

```bash
npx openapi-typescript <url-спецификации> -o src/channels/avito/client/generated/<api>.d.ts
```

Дальше `openapi-fetch` поверх сгенерированных типов, обёрнутый в наш
`core/http` клиент с rate limiter и логированием.
