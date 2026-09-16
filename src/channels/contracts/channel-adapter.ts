import type { ChannelCode } from '../../generated/prisma/enums.js';
import type { ChannelContext } from './channel-context.js';
import type {
  AccountIdentity,
  CanonicalSpendingPoint,
  CanonicalStatsPoint,
  ListingPage,
  OrdersPage,
  StatsQuery,
  StockQuantity,
} from './models.js';

/// Возможности площадки. Они разные: у Авито нет создания объявлений
/// через REST, у Drom беднее весь набор. Адаптер объявляет, что умеет,
/// а бизнес-логика проверяет это перед вызовом.
export enum Capability {
  READ_LISTINGS = 'READ_LISTINGS',
  WRITE_PRICE = 'WRITE_PRICE',
  WRITE_STOCK = 'WRITE_STOCK',
  READ_STOCK = 'READ_STOCK',
  READ_ORDERS = 'READ_ORDERS',
  TRANSITION_ORDERS = 'TRANSITION_ORDERS',
  READ_STATS = 'READ_STATS',
  MESSAGING = 'MESSAGING',
  PUBLISH_LISTINGS = 'PUBLISH_LISTINGS',
}

export interface ChannelAuth {
  /// Проверяет учётные данные и возвращает идентификатор аккаунта
  /// на стороне площадки.
  verify(ctx: ChannelContext): Promise<AccountIdentity>;
}

export interface ListingReader {
  /// Постраничный обход публикаций. Курсор непрозрачен для вызывающего кода:
  /// у одной площадки это номер страницы, у другой — токен.
  fetchListings(ctx: ChannelContext, cursor: string | null): Promise<ListingPage>;
}

export interface StatsReader {
  fetchDailyStats(ctx: ChannelContext, query: StatsQuery): Promise<CanonicalStatsPoint[]>;
  fetchDailySpendings?(
    ctx: ChannelContext,
    from: Date,
    to: Date,
  ): Promise<CanonicalSpendingPoint[]>;
}

export interface OrderReader {
  fetchOrders(ctx: ChannelContext, page: number): Promise<OrdersPage>;
}

export interface ChannelStockInfo {
  externalId: string;
  /// Доступное количество на площадке (уже за вычетом брони Авито).
  quantity: number;
  isUnlimited: boolean;
  isMultiple: boolean;
  isOutOfStock: boolean;
}

export interface StockWriter {
  pushStocks(ctx: ChannelContext, items: StockQuantity[]): Promise<void>;
}

export interface StockReader {
  fetchStocks(ctx: ChannelContext, externalIds: string[]): Promise<ChannelStockInfo[]>;
}

export type StockPort = StockWriter & StockReader;

export interface PriceWriter {
  updatePrice(ctx: ChannelContext, externalId: string, price: number): Promise<void>;
}

export interface VasOffer {
  externalId: string;
  vas: Array<{ slug: string; price: number; priceOld?: number }>;
  stickers: Array<{ id: number; title?: string; description?: string }>;
}

export interface ApplyVasInput {
  externalId: string;
  slugs: string[];
  stickers?: number[];
}

export interface PromotionWriter {
  fetchVasPrices(ctx: ChannelContext, externalIds: string[]): Promise<VasOffer[]>;
  applyVas(ctx: ChannelContext, input: ApplyVasInput): Promise<void>;
}

export interface WalletBalance {
  real: number;
  bonus: number;
}

export interface WalletOperation {
  amountBonus: number;
  amountRub: number;
  amountTotal: number;
  itemId: string | null;
  operationName: string;
  operationType: string;
  serviceName: string | null;
  serviceType: string | null;
  updatedAt: string;
}

export interface WalletReader {
  getBalance(ctx: ChannelContext): Promise<WalletBalance>;
  getOperationsHistory(
    ctx: ChannelContext,
    from: Date,
    to: Date,
  ): Promise<WalletOperation[]>;
}

export type CanonicalMessageDirection = 'IN' | 'OUT';
export type CanonicalMessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'LINK'
  | 'ITEM'
  | 'LOCATION'
  | 'CALL'
  | 'VOICE'
  | 'SYSTEM'
  | 'DELETED'
  | 'OTHER';

export interface CanonicalMessage {
  externalId: string;
  direction: CanonicalMessageDirection;
  type: CanonicalMessageType;
  bodyText: string | null;
  content: unknown;
  authorExternalId: string | null;
  isRead: boolean;
  sentAt: Date;
}

export interface CanonicalConversation {
  externalId: string;
  listingExternalId: string | null;
  listingTitle: string | null;
  peerExternalId: string | null;
  peerName: string | null;
  unreadCount: number;
  lastMessage: CanonicalMessage | null;
  updatedAt: Date;
}

export interface ConversationsPage {
  items: CanonicalConversation[];
  hasMore: boolean;
}

export interface MessagesPage {
  items: CanonicalMessage[];
  hasMore: boolean;
}

export interface SentMessage {
  message: CanonicalMessage;
}

export interface MessagingProvider {
  fetchConversations(
    ctx: ChannelContext,
    offset: number,
    limit: number,
  ): Promise<ConversationsPage>;
  fetchMessages(
    ctx: ChannelContext,
    chatExternalId: string,
    offset: number,
    limit: number,
  ): Promise<MessagesPage>;
  sendText(
    ctx: ChannelContext,
    chatExternalId: string,
    text: string,
  ): Promise<SentMessage>;
  uploadImage?(
    ctx: ChannelContext,
    file: { buffer: Buffer; filename: string; contentType: string },
  ): Promise<string>;
  sendImage?(
    ctx: ChannelContext,
    chatExternalId: string,
    imageId: string,
  ): Promise<SentMessage>;
  markRead?(ctx: ChannelContext, chatExternalId: string): Promise<void>;
  subscribeWebhook?(ctx: ChannelContext, url: string): Promise<void>;
  unsubscribeWebhook?(ctx: ChannelContext, url: string): Promise<void>;
}

export interface AutoloadReportItem {
  adId: string;
  avitoId: string | null;
  section: string | null;
  sectionTitle: string | null;
  avitoStatus: string | null;
  url: string | null;
  messages: Array<{ type?: string; code?: string; description?: string; title?: string }>;
}

export interface AutoloadReportPage {
  reportId: string;
  items: AutoloadReportItem[];
  hasMore: boolean;
}

export interface AutoloadIdLink {
  adId: string | null;
  avitoId: string;
}

export interface AutoloadProvider {
  triggerUpload(ctx: ChannelContext): Promise<void>;
  getLastCompletedReportId(ctx: ChannelContext): Promise<string | null>;
  getReportItems(
    ctx: ChannelContext,
    reportId: string,
    page: number,
    perPage: number,
  ): Promise<AutoloadReportPage>;
  resolveAvitoIds(ctx: ChannelContext, adIds: string[]): Promise<AutoloadIdLink[]>;
}

export interface CanonicalReview {
  externalId: string;
  score: number;
  text: string | null;
  stage: string | null;
  canAnswer: boolean;
  itemExternalId: string | null;
  itemTitle: string | null;
  authorName: string | null;
  publishedAt: Date | null;
  answerExternalId: string | null;
  answerText: string | null;
}

export interface ReviewsPage {
  items: CanonicalReview[];
  hasMore: boolean;
}

export interface ReviewsProvider {
  fetchReviews(ctx: ChannelContext, offset: number, limit: number): Promise<ReviewsPage>;
  answerReview(ctx: ChannelContext, reviewExternalId: string, text: string): Promise<{ answerId: string }>;
  deleteAnswer?(ctx: ChannelContext, answerExternalId: string): Promise<void>;
}

export interface OrderTransitionInput {
  externalId: string;
  transition: string;
  confirmCode?: string;
  marketplaceId?: string | null;
}

export interface OrderTrackingInput {
  externalId: string;
  trackingNumber: string;
}

export interface OrderReturnInput {
  externalId: string;
  terminalNumber: string;
  recipientName: string;
  recipientPhone: string;
}

export interface OrderMarkingItemInput {
  itemId: string;
  markings: string[];
}

export interface OrderMarkingsInput {
  externalId: string;
  items: OrderMarkingItemInput[];
}

export interface CourierDeliveryRange {
  address?: string;
  addressDetails?: string;
  name?: string;
  phone?: string;
  dateOptions: Array<{
    date: string;
    timeIntervals: Array<{
      startDate: string;
      endDate: string;
      title?: string;
      type?: string;
    }>;
  }>;
}

export interface SetCourierDeliveryRangeInput {
  externalId: string;
  address: string;
  addressDetails?: string;
  startDate: string;
  endDate: string;
  intervalType: 'fixed' | 'asap';
  phone: string;
  name: string;
}

export interface SetCncDetailsInput {
  externalId: string;
  marketplaceId: string;
  bookingPeriod: number;
  address?: string;
  details?: string;
}

export interface OrderTransitioner {
  applyTransition(ctx: ChannelContext, input: OrderTransitionInput): Promise<void>;
  setTrackingNumber(ctx: ChannelContext, input: OrderTrackingInput): Promise<void>;
  acceptReturn?(ctx: ChannelContext, input: OrderReturnInput): Promise<void>;
  /// marketplaceId — ID заказа в сервисе сделок Авито (не externalId).
  downloadLabels?(ctx: ChannelContext, marketplaceId: string): Promise<Buffer>;
  setMarkings?(ctx: ChannelContext, input: OrderMarkingsInput): Promise<void>;
  getCourierDeliveryRange?(
    ctx: ChannelContext,
    externalId: string,
    address?: string,
  ): Promise<CourierDeliveryRange>;
  setCourierDeliveryRange?(
    ctx: ChannelContext,
    input: SetCourierDeliveryRangeInput,
  ): Promise<void>;
  setCncDetails?(ctx: ChannelContext, input: SetCncDetailsInput): Promise<void>;
}

export interface ChannelAdapter {
  readonly code: ChannelCode;
  readonly capabilities: ReadonlySet<Capability>;

  readonly auth: ChannelAuth;
  readonly listings?: ListingReader;
  readonly stats?: StatsReader;
  readonly orders?: OrderReader;
  readonly orderTransitions?: OrderTransitioner;
  readonly stocks?: StockPort;
  readonly prices?: PriceWriter;
  readonly promotions?: PromotionWriter;
  readonly wallet?: WalletReader;
  readonly messaging?: MessagingProvider;
  readonly autoload?: AutoloadProvider;
  readonly reviews?: ReviewsProvider;
}
