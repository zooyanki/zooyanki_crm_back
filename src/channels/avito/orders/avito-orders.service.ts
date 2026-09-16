import { Injectable } from '@nestjs/common';

import type {
  CourierDeliveryRange,
  OrderMarkingsInput,
  OrderReader,
  OrderReturnInput,
  OrderTransitioner,
  OrderTrackingInput,
  OrderTransitionInput,
  SetCncDetailsInput,
  SetCourierDeliveryRangeInput,
} from '../../contracts/channel-adapter.js';
import type { ChannelContext } from '../../contracts/channel-context.js';
import type { CanonicalOrder, OrdersPage } from '../../contracts/models.js';
import { sleep } from '../../../core/utils/sleep.js';
import { ChannelHttpError } from '../../../core/http/channel-http.error.js';
import { AVITO_ENDPOINTS, AVITO_RATE_LIMITS } from '../avito.constants.js';
import { AvitoApiClient } from '../client/avito-api.client.js';
import type {
  AvitoAcceptReturnOrderRequest,
  AvitoAcceptReturnOrderResponse,
  AvitoApplyTransitionRequest,
  AvitoApplyTransitionResponse,
  AvitoCncSetDetailsRequest,
  AvitoCncSetDetailsResponse,
  AvitoGetCourierDeliveryRangeResponse,
  AvitoOrder,
  AvitoOrderAction,
  AvitoOrderTransition,
  AvitoOrdersLabelsRequest,
  AvitoOrdersLabelsResponse,
  AvitoOrdersResponse,
  AvitoSetCourierDeliveryRangeRequest,
  AvitoSetCourierDeliveryRangeResponse,
  AvitoSetOrderMarkingRequest,
  AvitoSetOrderMarkingResponse,
  AvitoSetTrackingNumberRequest,
  AvitoSetTrackingNumberResponse,
} from '../client/avito-api.types.js';
import { mapAvitoOrderStatus } from '../mappers/order.mapper.js';

const PAGE_LIMIT = 20;
const LABELS_POLL_ATTEMPTS = 15;
const LABELS_POLL_DELAY_MS = 2_000;

const TRANSITIONS = new Set<AvitoOrderTransition>(['confirm', 'reject', 'perform', 'receive']);

@Injectable()
export class AvitoOrdersService implements OrderReader, OrderTransitioner {
  constructor(private readonly api: AvitoApiClient) {}

  async fetchOrders(ctx: ChannelContext, page: number): Promise<OrdersPage> {
    const response = await this.api.request<AvitoOrdersResponse>(ctx, {
      method: 'GET',
      path: AVITO_ENDPOINTS.orders,
      endpoint: AVITO_ENDPOINTS.orders,
      query: {
        page,
        limit: PAGE_LIMIT,
      },
      rateLimitPerMinute: AVITO_RATE_LIMITS.orders,
    });

    return {
      items: (response.orders ?? []).map(toCanonicalOrder),
      hasMore: Boolean(response.hasMore),
      nextPage: response.hasMore ? page + 1 : null,
    };
  }

  async applyTransition(ctx: ChannelContext, input: OrderTransitionInput): Promise<void> {
    if (!TRANSITIONS.has(input.transition as AvitoOrderTransition)) {
      throw new Error(`Неизвестный переход Авито: ${input.transition}`);
    }

    const body: AvitoApplyTransitionRequest = {
      orderId: input.externalId,
      transition: input.transition as AvitoOrderTransition,
    };

    if (input.confirmCode || input.marketplaceId) {
      body.params = {
        cnc: {
          ...(input.confirmCode ? { confirmCode: input.confirmCode } : {}),
          ...(input.marketplaceId ? { marketplaceId: input.marketplaceId } : {}),
        },
      };
    }

    const response = await this.api.request<AvitoApplyTransitionResponse>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.applyTransition,
      endpoint: AVITO_ENDPOINTS.applyTransition,
      json: body,
      rateLimitPerMinute: AVITO_RATE_LIMITS.applyTransition,
    });

    if (!response.success) {
      throw new Error(`Авито не применила переход ${input.transition} к заказу ${input.externalId}`);
    }
  }

  async setTrackingNumber(ctx: ChannelContext, input: OrderTrackingInput): Promise<void> {
    const body: AvitoSetTrackingNumberRequest = {
      orderId: input.externalId,
      trackingNumber: input.trackingNumber,
    };

    const response = await this.api.request<AvitoSetTrackingNumberResponse>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.setTrackingNumber,
      endpoint: AVITO_ENDPOINTS.setTrackingNumber,
      json: body,
      rateLimitPerMinute: AVITO_RATE_LIMITS.setTrackingNumber,
    });

    if (!response.success) {
      const detail = response.error
        ? `${response.error.code}: ${response.error.message}`
        : 'ошибка';
      throw new Error(`Авито отклонила трек-номер: ${detail}`);
    }
  }

  async acceptReturn(ctx: ChannelContext, input: OrderReturnInput): Promise<void> {
    const body: AvitoAcceptReturnOrderRequest = {
      orderId: input.externalId,
      terminalNumber: input.terminalNumber,
      recipient: {
        name: input.recipientName,
        phone: input.recipientPhone,
      },
    };

    const response = await this.api.request<AvitoAcceptReturnOrderResponse>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.acceptReturnOrder,
      endpoint: AVITO_ENDPOINTS.acceptReturnOrder,
      json: body,
      rateLimitPerMinute: AVITO_RATE_LIMITS.acceptReturnOrder,
    });

    if (!response.success) {
      throw new Error(`Авито не приняла возврат для заказа ${input.externalId}`);
    }
  }

  async downloadLabels(ctx: ChannelContext, marketplaceId: string): Promise<Buffer> {
    const createBody: AvitoOrdersLabelsRequest = {
      orderIDs: [marketplaceId],
    };

    const created = await this.api.request<AvitoOrdersLabelsResponse>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.orderLabels,
      endpoint: AVITO_ENDPOINTS.orderLabels,
      json: createBody,
      rateLimitPerMinute: AVITO_RATE_LIMITS.orderLabels,
    });

    const taskId = created.taskID;
    if (!taskId) {
      throw new Error('Авито не вернула taskID для генерации этикеток');
    }

    const downloadPath = AVITO_ENDPOINTS.orderLabelsDownload.replace('{taskID}', taskId);

    for (let attempt = 1; attempt <= LABELS_POLL_ATTEMPTS; attempt += 1) {
      try {
        const pdf = await this.api.request<Buffer>(ctx, {
          method: 'GET',
          path: downloadPath,
          endpoint: AVITO_ENDPOINTS.orderLabelsDownload,
          headers: { Accept: 'application/pdf' },
          responseType: 'buffer',
          rateLimitPerMinute: AVITO_RATE_LIMITS.orderLabelsDownload,
        });

        if (pdf.length > 0) {
          return pdf;
        }
      } catch (error) {
        const retryable =
          error instanceof ChannelHttpError &&
          (error.status === 404 || error.status === 425 || error.isRetryable);

        if (!retryable || attempt === LABELS_POLL_ATTEMPTS) {
          throw error;
        }
      }

      await sleep(LABELS_POLL_DELAY_MS);
    }

    throw new Error('Этикетка не успела сгенерироваться на стороне Авито');
  }

  async setMarkings(ctx: ChannelContext, input: OrderMarkingsInput): Promise<void> {
    if (input.items.length === 0) {
      throw new Error('Нужна хотя бы одна маркировка');
    }

    const body: AvitoSetOrderMarkingRequest = {
      markings: input.items.map((item) => ({
        itemId: item.itemId,
        orderId: input.externalId,
        markings: item.markings,
      })),
    };

    await this.api.request<AvitoSetOrderMarkingResponse>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.markings,
      endpoint: AVITO_ENDPOINTS.markings,
      json: body,
      rateLimitPerMinute: AVITO_RATE_LIMITS.markings,
    });
  }

  async getCourierDeliveryRange(
    ctx: ChannelContext,
    externalId: string,
    address?: string,
  ): Promise<CourierDeliveryRange> {
    const response = await this.api.request<AvitoGetCourierDeliveryRangeResponse>(ctx, {
      method: 'GET',
      path: AVITO_ENDPOINTS.getCourierDeliveryRange,
      endpoint: AVITO_ENDPOINTS.getCourierDeliveryRange,
      query: {
        orderId: externalId,
        ...(address ? { address } : {}),
      },
      rateLimitPerMinute: AVITO_RATE_LIMITS.getCourierDeliveryRange,
    });

    return {
      address: response.result?.address,
      addressDetails: response.result?.addressDetails,
      name: response.result?.name,
      phone: response.result?.phone,
      dateOptions: (response.result?.dateOptions ?? []).map((option) => ({
        date: option.date,
        timeIntervals: (option.timeIntervals ?? []).map((interval) => ({
          startDate: interval.startDate,
          endDate: interval.endDate,
          title: interval.title,
          type: interval.type,
        })),
      })),
    };
  }

  async setCourierDeliveryRange(
    ctx: ChannelContext,
    input: SetCourierDeliveryRangeInput,
  ): Promise<void> {
    const body: AvitoSetCourierDeliveryRangeRequest = {
      orderId: input.externalId,
      address: input.address,
      addressDetails: input.addressDetails,
      startDate: input.startDate,
      endDate: input.endDate,
      intervalType: input.intervalType,
      phone: input.phone,
      name: input.name,
    };

    const response = await this.api.request<AvitoSetCourierDeliveryRangeResponse>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.setCourierDeliveryRange,
      endpoint: AVITO_ENDPOINTS.setCourierDeliveryRange,
      json: body,
      rateLimitPerMinute: AVITO_RATE_LIMITS.setCourierDeliveryRange,
    });

    if (!response.success) {
      throw new Error(`Авито не приняла окно курьера для заказа ${input.externalId}`);
    }
  }

  async setCncDetails(ctx: ChannelContext, input: SetCncDetailsInput): Promise<void> {
    const body: AvitoCncSetDetailsRequest = {
      id: input.externalId,
      marketplaceId: input.marketplaceId,
      bookingPeriod: input.bookingPeriod,
      address: input.address,
      details: input.details,
    };

    await this.api.request<AvitoCncSetDetailsResponse>(ctx, {
      method: 'POST',
      path: AVITO_ENDPOINTS.cncSetDetails,
      endpoint: AVITO_ENDPOINTS.cncSetDetails,
      json: body,
      rateLimitPerMinute: AVITO_RATE_LIMITS.cncSetDetails,
    });
  }
}

function toCanonicalOrder(order: AvitoOrder): CanonicalOrder {
  return {
    externalId: String(order.id),
    marketplaceId: order.marketplaceId ? String(order.marketplaceId) : null,
    status: mapAvitoOrderStatus(order.status),
    rawStatus: order.status,
    availableActions: normalizeActions(order.availableActions),
    totalAmount: order.prices?.total ?? order.prices?.price ?? null,
    commissionAmount: order.prices?.commission ?? null,
    deliveryAmount: order.prices?.delivery ?? null,
    discountAmount: order.prices?.discount ?? null,
    currency: 'RUB',
    delivery: order.delivery ?? null,
    schedules: order.schedules ?? null,
    placedAt: new Date(order.createdAt),
    items: (order.items ?? []).map((item) => ({
      externalId: item.id ? String(item.id) : null,
      avitoId: item.avitoId ? String(item.avitoId) : null,
      title: item.title,
      quantity: item.count,
      price: item.prices?.price ?? 0,
      total: item.prices?.total ?? item.prices?.price ?? 0,
      currency: 'RUB',
    })),
  };
}

function normalizeActions(raw: unknown): AvitoOrderAction[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const actions: AvitoOrderAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as { name?: unknown; required?: unknown };
    if (typeof row.name !== 'string') {
      continue;
    }
    actions.push({
      name: row.name,
      required: Boolean(row.required),
    });
  }

  return actions;
}
