import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ChannelRegistry } from '../channels/channel.registry.js';
import { Capability } from '../channels/contracts/channel-adapter.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ChannelCode, OrderStatus } from '../generated/prisma/enums.js';
import { ChannelAccountsService } from '../integrations/channel-accounts/channel-accounts.service.js';
import { PrismaService } from '../core/db/prisma.service.js';
import { OutboxService } from '../core/outbox/outbox.service.js';
import {
  OUTBOX_TYPES,
  type OrderAcceptReturnPayload,
  type OrderCncDetailsPayload,
  type OrderCourierRangePayload,
  type OrderMarkingsPayload,
  type OrderTrackingPayload,
  type OrderTransitionPayload,
} from '../core/outbox/outbox.types.js';

export interface OrderActionView {
  name: string;
  required: boolean;
}

export interface OrderItemView {
  id: string;
  title: string;
  quantity: number;
  price: number;
  total: number;
  avitoId: string | null;
}

export interface OrderView {
  id: string;
  channel: ChannelCode;
  channelAccountId: string;
  externalId: string;
  marketplaceId: string | null;
  status: OrderStatus;
  rawStatus: string;
  availableActions: OrderActionView[];
  totalAmount: number | null;
  currency: string;
  placedAt: Date;
  syncedAt: Date | null;
  items: OrderItemView[];
}

export interface OrderListQuery {
  status?: OrderStatus;
  page: number;
  perPage: number;
}

export interface OrderListResult {
  items: OrderView[];
  total: number;
  page: number;
  perPage: number;
}

export interface QueueTransitionInput {
  transition: string;
  confirmCode?: string;
}

export interface QueueTrackingInput {
  trackingNumber: string;
}

export interface QueueAcceptReturnInput {
  terminalNumber: string;
  recipientName: string;
  recipientPhone: string;
}

export interface QueuedActionResult {
  queued: true;
  orderId: string;
}

export interface OrderLabelsResult {
  filename: string;
  contentType: string;
  data: string;
}

export interface QueueMarkingsInput {
  items: Array<{
    itemId: string;
    markings: string[];
  }>;
}

export interface QueueCourierRangeInput {
  address: string;
  addressDetails?: string;
  startDate: string;
  endDate: string;
  intervalType: 'fixed' | 'asap';
  phone: string;
  name: string;
}

export interface QueueCncDetailsInput {
  bookingPeriod: number;
  address?: string;
  details?: string;
}

export interface CourierRangeResult {
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

const APPLY_TRANSITIONS = new Set(['confirm', 'reject', 'perform', 'receive']);

const LABEL_STATUSES = new Set<OrderStatus>(['READY_TO_SHIP', 'IN_TRANSIT']);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly accounts: ChannelAccountsService,
    private readonly registry: ChannelRegistry,
  ) {}

  async list(tenantId: string, query: OrderListQuery): Promise<OrderListResult> {
    const where = {
      ...(query.status ? { status: query.status } : {}),
    };

    return this.prisma.withTenant(tenantId, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.order.findMany({
          where,
          include: { items: true },
          orderBy: { placedAt: 'desc' },
          skip: (query.page - 1) * query.perPage,
          take: query.perPage,
        }),
        tx.order.count({ where }),
      ]);

      return {
        items: rows.map((row) => toView(row)),
        total,
        page: query.page,
        perPage: query.perPage,
      };
    });
  }

  async queueTransition(
    tenantId: string,
    orderId: string,
    input: QueueTransitionInput,
  ): Promise<QueuedActionResult> {
    if (!APPLY_TRANSITIONS.has(input.transition)) {
      throw new BadRequestException(
        `Переход «${input.transition}» не поддерживается. Допустимы: confirm, reject, perform, receive`,
      );
    }

    const order = await this.requireOrder(tenantId, orderId);
    assertActionAllowed(order.availableActions, input.transition);

    const payload = {
      orderId: order.id,
      externalId: order.externalId,
      transition: input.transition,
      confirmCode: input.confirmCode,
      marketplaceId: order.marketplaceId,
    } satisfies OrderTransitionPayload;

    await this.outbox.enqueue({
      tenantId,
      channelAccountId: order.channelAccountId,
      type: OUTBOX_TYPES.ORDER_TRANSITION,
      payload: payload as Prisma.InputJsonValue,
      idempotencyKey: `order-transition:${order.id}:${input.transition}:${Date.now()}`,
    });

    return { queued: true, orderId: order.id };
  }

  async queueTrackingNumber(
    tenantId: string,
    orderId: string,
    input: QueueTrackingInput,
  ): Promise<QueuedActionResult> {
    const trackingNumber = input.trackingNumber.trim();
    if (!trackingNumber) {
      throw new BadRequestException('Укажите трек-номер');
    }

    const order = await this.requireOrder(tenantId, orderId);
    const actions = parseActions(order.availableActions);
    const allowed = actions.some(
      (action) => action.name === 'setTrackNumber' || action.name === 'fixTrackNumber',
    );

    if (!allowed) {
      throw new BadRequestException('Для этого заказа сейчас нельзя передать трек-номер');
    }

    const payload = {
      orderId: order.id,
      externalId: order.externalId,
      trackingNumber,
    } satisfies OrderTrackingPayload;

    await this.outbox.enqueue({
      tenantId,
      channelAccountId: order.channelAccountId,
      type: OUTBOX_TYPES.ORDER_TRACKING,
      payload: payload as Prisma.InputJsonValue,
      idempotencyKey: `order-tracking:${order.id}:${trackingNumber}`,
    });

    return { queued: true, orderId: order.id };
  }

  async queueAcceptReturn(
    tenantId: string,
    orderId: string,
    input: QueueAcceptReturnInput,
  ): Promise<QueuedActionResult> {
    const terminalNumber = input.terminalNumber.trim();
    const recipientName = input.recipientName.trim();
    const recipientPhone = input.recipientPhone.trim();

    if (!terminalNumber) {
      throw new BadRequestException('Укажите номер отделения Почты России');
    }
    if (!recipientName) {
      throw new BadRequestException('Укажите ФИО получателя');
    }
    if (!recipientPhone) {
      throw new BadRequestException('Укажите телефон получателя');
    }

    const order = await this.requireOrder(tenantId, orderId);
    assertActionAllowed(order.availableActions, 'acceptReturnOrder');

    const payload = {
      orderId: order.id,
      externalId: order.externalId,
      terminalNumber,
      recipientName,
      recipientPhone,
    } satisfies OrderAcceptReturnPayload;

    await this.outbox.enqueue({
      tenantId,
      channelAccountId: order.channelAccountId,
      type: OUTBOX_TYPES.ORDER_ACCEPT_RETURN,
      payload: payload as Prisma.InputJsonValue,
      idempotencyKey: `order-return:${order.id}:${terminalNumber}`,
    });

    return { queued: true, orderId: order.id };
  }

  async downloadLabels(tenantId: string, orderId: string): Promise<OrderLabelsResult> {
    const order = await this.requireOrder(tenantId, orderId);

    if (!order.marketplaceId) {
      throw new BadRequestException('У заказа нет marketplaceId для генерации этикетки');
    }

    if (!LABEL_STATUSES.has(order.status)) {
      throw new BadRequestException('Этикетку можно скачать только для заказов к отправке или в пути');
    }

    const account = await this.accounts.requireForTenant(tenantId, order.channelAccountId);
    const adapter = this.registry.get(account.channel);

    if (
      !adapter.orderTransitions?.downloadLabels ||
      !adapter.capabilities.has(Capability.TRANSITION_ORDERS)
    ) {
      throw new BadRequestException('Площадка не поддерживает скачивание этикеток');
    }

    const pdf = await adapter.orderTransitions.downloadLabels(
      { tenantId, channelAccountId: order.channelAccountId },
      order.marketplaceId,
    );

    return {
      filename: `label-${order.externalId}.pdf`,
      contentType: 'application/pdf',
      data: pdf.toString('base64'),
    };
  }

  async queueMarkings(
    tenantId: string,
    orderId: string,
    input: QueueMarkingsInput,
  ): Promise<QueuedActionResult> {
    if (!input.items.length) {
      throw new BadRequestException('Передайте маркировки хотя бы для одной позиции');
    }

    for (const item of input.items) {
      if (!item.itemId.trim() || item.markings.length === 0) {
        throw new BadRequestException('У каждой позиции нужен itemId и хотя бы один код');
      }
    }

    const order = await this.requireOrder(tenantId, orderId);
    assertActionAllowed(order.availableActions, 'setMarkings');

    const payload = {
      orderId: order.id,
      externalId: order.externalId,
      items: input.items.map((item) => ({
        itemId: item.itemId.trim(),
        markings: item.markings.map((code) => code.trim()).filter(Boolean),
      })),
    } satisfies OrderMarkingsPayload;

    await this.outbox.enqueue({
      tenantId,
      channelAccountId: order.channelAccountId,
      type: OUTBOX_TYPES.ORDER_MARKINGS,
      payload: payload as Prisma.InputJsonValue,
      idempotencyKey: `order-markings:${order.id}:${Date.now()}`,
    });

    return { queued: true, orderId: order.id };
  }

  async getCourierRange(
    tenantId: string,
    orderId: string,
    address?: string,
  ): Promise<CourierRangeResult> {
    const order = await this.requireOrder(tenantId, orderId);
    const actions = parseActions(order.availableActions);
    const allowed =
      actions.length === 0 ||
      actions.some(
        (action) =>
          action.name === 'getCourierDeliveryRange' ||
          action.name === 'setCourierDeliveryRange',
      );
    if (!allowed) {
      throw new BadRequestException('Окна курьера сейчас недоступны для этого заказа');
    }

    const account = await this.accounts.requireForTenant(tenantId, order.channelAccountId);
    const adapter = this.registry.get(account.channel);

    if (!adapter.orderTransitions?.getCourierDeliveryRange) {
      throw new BadRequestException('Площадка не поддерживает окна курьера');
    }

    return adapter.orderTransitions.getCourierDeliveryRange(
      { tenantId, channelAccountId: order.channelAccountId },
      order.externalId,
      address?.trim() || undefined,
    );
  }

  async queueCourierRange(
    tenantId: string,
    orderId: string,
    input: QueueCourierRangeInput,
  ): Promise<QueuedActionResult> {
    const order = await this.requireOrder(tenantId, orderId);
    assertActionAllowed(order.availableActions, 'setCourierDeliveryRange');

    const payload = {
      orderId: order.id,
      externalId: order.externalId,
      address: input.address.trim(),
      addressDetails: input.addressDetails?.trim() || undefined,
      startDate: input.startDate,
      endDate: input.endDate,
      intervalType: input.intervalType,
      phone: input.phone.trim(),
      name: input.name.trim(),
    } satisfies OrderCourierRangePayload;

    if (!payload.address || !payload.phone || !payload.name) {
      throw new BadRequestException('Нужны адрес, телефон и ФИО');
    }

    await this.outbox.enqueue({
      tenantId,
      channelAccountId: order.channelAccountId,
      type: OUTBOX_TYPES.ORDER_COURIER_RANGE,
      payload: payload as Prisma.InputJsonValue,
      idempotencyKey: `order-courier:${order.id}:${payload.startDate}:${payload.endDate}`,
    });

    return { queued: true, orderId: order.id };
  }

  async queueCncDetails(
    tenantId: string,
    orderId: string,
    input: QueueCncDetailsInput,
  ): Promise<QueuedActionResult> {
    if (!Number.isFinite(input.bookingPeriod) || input.bookingPeriod < 1) {
      throw new BadRequestException('Укажите срок бронирования в днях');
    }

    const order = await this.requireOrder(tenantId, orderId);
    assertActionAllowed(order.availableActions, 'setCNCDetails');

    if (!order.marketplaceId) {
      throw new BadRequestException('У заказа нет marketplaceId для CNC');
    }

    const payload = {
      orderId: order.id,
      externalId: order.externalId,
      marketplaceId: order.marketplaceId,
      bookingPeriod: Math.trunc(input.bookingPeriod),
      address: input.address?.trim() || undefined,
      details: input.details?.trim() || undefined,
    } satisfies OrderCncDetailsPayload;

    await this.outbox.enqueue({
      tenantId,
      channelAccountId: order.channelAccountId,
      type: OUTBOX_TYPES.ORDER_CNC_DETAILS,
      payload: payload as Prisma.InputJsonValue,
      idempotencyKey: `order-cnc:${order.id}:${payload.bookingPeriod}`,
    });

    return { queued: true, orderId: order.id };
  }

  private async requireOrder(tenantId: string, orderId: string) {
    const order = await this.prisma.withTenant(tenantId, (tx) =>
      tx.order.findUnique({ where: { id: orderId } }),
    );

    if (!order) {
      throw new NotFoundException(`Заказ ${orderId} не найден`);
    }

    return order;
  }
}

function toView(row: {
  id: string;
  channel: ChannelCode;
  channelAccountId: string;
  externalId: string;
  marketplaceId: string | null;
  status: OrderStatus;
  rawStatus: string;
  availableActions: Prisma.JsonValue | null;
  totalAmount: { toString(): string } | null;
  currency: string;
  placedAt: Date;
  syncedAt: Date | null;
  items: Array<{
    id: string;
    title: string;
    quantity: number;
    price: { toString(): string };
    total: { toString(): string };
    avitoId: string | null;
  }>;
}): OrderView {
  return {
    id: row.id,
    channel: row.channel,
    channelAccountId: row.channelAccountId,
    externalId: row.externalId,
    marketplaceId: row.marketplaceId,
    status: row.status,
    rawStatus: row.rawStatus,
    availableActions: parseActions(row.availableActions),
    totalAmount: row.totalAmount === null ? null : Number(row.totalAmount),
    currency: row.currency,
    placedAt: row.placedAt,
    syncedAt: row.syncedAt,
    items: row.items.map((item) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      price: Number(item.price),
      total: Number(item.total),
      avitoId: item.avitoId,
    })),
  };
}

function parseActions(raw: Prisma.JsonValue | null | undefined): OrderActionView[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const row = item as { name?: unknown; required?: unknown };
      if (typeof row.name !== 'string') {
        return null;
      }
      return { name: row.name, required: Boolean(row.required) };
    })
    .filter((item): item is OrderActionView => item !== null);
}

function assertActionAllowed(
  availableActions: Prisma.JsonValue | null,
  transition: string,
): void {
  const actions = parseActions(availableActions);
  if (actions.length === 0) {
    // Синк мог ещё не принести availableActions — разрешаем известные переходы,
    // Авито отклонит недопустимые.
    return;
  }

  if (!actions.some((action) => action.name === transition)) {
    throw new BadRequestException(
      `Переход «${transition}» сейчас недоступен для этого заказа`,
    );
  }
}
