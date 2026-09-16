/// Ответы API Авито в минимально необходимом объёме.
/// Поля, которые мы не используем, намеренно не описаны.

export interface AvitoTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface AvitoAccountSelf {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  profile_url?: string;
}

export interface AvitoItem {
  id: number;
  title?: string;
  /// null, если цена у объявления не указана
  price?: number | null;
  status?: 'active' | 'removed' | 'old' | 'blocked' | 'rejected';
  url?: string | null;
  address?: string;
  category?: { id: number; name?: string };
}

/// В meta нет общего числа страниц — только текущая страница и её размер,
/// поэтому конец списка определяется по неполной странице.
export interface AvitoItemsResponse {
  meta: {
    page: number;
    per_page: number;
  };
  resources: AvitoItem[];
}

export interface AvitoStatsRequest {
  dateFrom: string;
  dateTo: string;
  fields: string[];
  itemIds: number[];
  periodGrouping: 'day';
}

export interface AvitoStatsResponse {
  result: {
    items: Array<{
      itemId: number;
      stats: Array<{
        date: string;
        uniqViews?: number;
        uniqContacts?: number;
        uniqFavorites?: number;
      }>;
    }>;
  };
}

export interface AvitoSpendingsRequest {
  dateFrom: string;
  dateTo: string;
  grouping: 'day' | 'week' | 'month';
  spendingTypes: Array<'all' | 'promotion' | 'presence' | 'commission' | 'rest'>;
}

export interface AvitoSpendingsResponse {
  result: {
    groupings: Array<{
      date?: string;
      type?: string;
      spendings: Array<{
        slug: string;
        value: number;
        services?: Array<{ slug: string; value: number }>;
      }>;
    }>;
  };
}

export interface AvitoOrderItem {
  id?: string;
  avitoId: string;
  title: string;
  count: number;
  chatId?: string;
  prices?: {
    price?: number;
    total?: number;
    commission?: number;
    discountSum?: number;
  };
}

export interface AvitoOrder {
  id: string;
  marketplaceId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  availableActions?: unknown;
  items: AvitoOrderItem[];
  prices?: {
    price?: number;
    total?: number;
    commission?: number;
    delivery?: number;
    discount?: number;
  };
  delivery?: unknown;
  schedules?: unknown;
}

export interface AvitoOrdersResponse {
  orders: AvitoOrder[];
  hasMore: boolean;
}

export interface AvitoStockItem {
  item_id: number;
  quantity: number;
  external_id?: string;
}

export interface AvitoStocksRequest {
  stocks: AvitoStockItem[];
}

export interface AvitoStockEditResult {
  item_id?: number;
  external_id?: string;
  success: boolean;
  errors?: string[];
}

export interface AvitoStocksResponse {
  stocks: AvitoStockEditResult[];
}

export interface AvitoStocksInfoRequest {
  item_ids: number[];
  strong_consistency?: boolean;
}

export interface AvitoStockInfoItem {
  item_id: number;
  quantity: number;
  is_unlimited: boolean;
  is_multiple: boolean;
  is_out_of_stock: boolean;
}

export interface AvitoStocksInfoResponse {
  stocks?: AvitoStockInfoItem[];
}

export type AvitoOrderTransition = 'confirm' | 'reject' | 'perform' | 'receive';

export interface AvitoApplyTransitionRequest {
  orderId: string;
  transition: AvitoOrderTransition;
  params?: {
    cnc?: {
      confirmCode?: string;
      marketplaceId?: string;
    } | null;
  } | null;
}

export interface AvitoApplyTransitionResponse {
  success: boolean;
}

export interface AvitoSetTrackingNumberRequest {
  orderId: string;
  trackingNumber: string;
}

export interface AvitoSetTrackingNumberResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface AvitoOrdersLabelsRequest {
  orderIDs: string[];
}

export interface AvitoOrdersLabelsResponse {
  taskID: string;
}

export interface AvitoAcceptReturnOrderRequest {
  orderId: string;
  terminalNumber: string;
  recipient: {
    name: string;
    phone: string;
  };
}

export interface AvitoAcceptReturnOrderResponse {
  success: boolean;
}

export interface AvitoMarkingItem {
  itemId: string;
  orderId: string;
  markings: string[];
}

export interface AvitoSetOrderMarkingRequest {
  markings: AvitoMarkingItem[];
}

export interface AvitoSetOrderMarkingResponse {
  success?: boolean;
}

export interface AvitoCourierTimeInterval {
  startDate: string;
  endDate: string;
  title?: string;
  type?: string;
}

export interface AvitoCourierDateOption {
  date: string;
  timeIntervals?: AvitoCourierTimeInterval[];
}

export interface AvitoGetCourierDeliveryRangeResponse {
  status: string;
  result: {
    address?: string;
    addressDetails?: string;
    name?: string;
    phone?: string;
    startDate?: string;
    endDate?: string;
    dateOptions: AvitoCourierDateOption[];
  };
}

export interface AvitoSetCourierDeliveryRangeRequest {
  orderId: string;
  address: string;
  addressDetails?: string;
  startDate: string;
  endDate: string;
  intervalType: 'fixed' | 'asap';
  phone: string;
  name: string;
}

export interface AvitoSetCourierDeliveryRangeResponse {
  success: boolean;
}

export interface AvitoCncSetDetailsRequest {
  id: string;
  marketplaceId: string;
  bookingPeriod: number;
  address?: string;
  details?: string;
}

export interface AvitoCncSetDetailsResponse {
  success?: boolean;
}

export interface AvitoUpdatePriceRequest {
  price: number;
}

export interface AvitoUpdatePriceResponse {
  result?: {
    success?: boolean;
  };
  success?: boolean;
}

export interface AvitoVasPriceItem {
  slug: string;
  price: number;
  priceOld?: number;
}

export interface AvitoVasSticker {
  id: number;
  title?: string;
  description?: string;
}

export interface AvitoVasPricesItem {
  itemId: number;
  vas?: AvitoVasPriceItem[];
  stickers?: AvitoVasSticker[];
}

export type AvitoVasPricesResponse = AvitoVasPricesItem[];

export interface AvitoApplyVasRequest {
  slugs: string[];
  stickers?: number[];
}

export type AvitoApplyVasResponse = Record<string, { operationId?: number }>;

export interface AvitoBalanceResponse {
  real: number;
  bonus: number;
}

export interface AvitoOperationsHistoryRequest {
  dateTimeFrom: string;
  dateTimeTo: string;
}

export interface AvitoOperationsHistoryItem {
  amountBonus?: number;
  amountRub?: number;
  amountTotal?: number;
  itemId?: number;
  operationName?: string;
  operationType?: string;
  serviceId?: number;
  serviceName?: string;
  serviceType?: string;
  updatedAt?: string;
}

export interface AvitoOperationsHistoryResponse {
  result?: {
    operations?: AvitoOperationsHistoryItem[];
  };
  operations?: AvitoOperationsHistoryItem[];
}

export interface AvitoMessageContent {
  text?: string | null;
  image?: {
    sizes?: Record<string, string>;
  };
  link?: unknown;
  item?: unknown;
  location?: unknown;
  voice?: { voice_id?: string };
  call?: unknown;
}

export interface AvitoMessage {
  id: string;
  author_id?: number;
  created?: number;
  direction?: 'in' | 'out' | string;
  type?: string;
  is_read?: boolean;
  read?: number | null;
  content?: AvitoMessageContent | null;
}

export interface AvitoChatUser {
  id?: number;
  name?: string;
}

export interface AvitoChat {
  id: string;
  created?: number;
  updated?: number;
  context?: {
    type?: string;
    value?: {
      id?: number;
      title?: string;
      url?: string;
      price_string?: string;
    };
  };
  users?: AvitoChatUser[];
  last_message?: AvitoMessage;
}

export interface AvitoChatsResponse {
  chats?: AvitoChat[];
}

export type AvitoMessagesResponse = AvitoMessage[] | { messages?: AvitoMessage[] };

export interface AvitoSendMessageResponse extends AvitoMessage {}

export type AvitoUploadImagesResponse = Record<string, Record<string, string>>;

export interface AvitoWebhookEnvelope {
  id?: string;
  version?: string;
  timestamp?: number;
  payload?: {
    type?: string;
    value?: {
      id?: string;
      chat_id?: string;
      user_id?: number;
      author_id?: number;
      type?: string;
      content?: AvitoMessageContent | null;
      created?: number;
      published_at?: string;
      item_id?: number | null;
      chat_type?: string;
      read?: number | null;
    };
  };
}

export interface AvitoAutoloadLastReportResponse {
  report_id?: number | string;
  id?: number | string;
}

export interface AvitoAutoloadReportItem {
  ad_id: string;
  avito_id?: number | null;
  avito_status?: string | null;
  url?: string | null;
  section?: { slug: string; title: string };
  messages?: Array<{
    type?: string;
    code?: string | number;
    description?: string;
    title?: string;
  }>;
}

export interface AvitoAutoloadReportItemsResponse {
  report_id?: number | string;
  items?: AvitoAutoloadReportItem[];
  meta?: { page?: number; per_page?: number; pages?: number };
}

export interface AvitoAutoloadAvitoIdsResponse {
  items?: Array<{ ad_id?: string | null; avito_id: number }>;
}

export interface AvitoReviewsResponse {
  reviews?: Array<Record<string, unknown>>;
  result?: { reviews?: Array<Record<string, unknown>> };
  total?: number;
}

export interface AvitoCreateAnswerResponse {
  answerId?: number | string;
  id?: number | string;
  result?: { id?: number | string };
}

export interface AvitoOrderAction {
  name: string;
  required?: boolean;
}

