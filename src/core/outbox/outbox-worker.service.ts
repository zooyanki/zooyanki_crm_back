import { Injectable, Logger } from '@nestjs/common';

import { Interval } from '@nestjs/schedule';



import { ChannelRegistry } from '../../channels/channel.registry.js';

import { Capability } from '../../channels/contracts/channel-adapter.js';

import type { StockQuantity } from '../../channels/contracts/models.js';

import type { Prisma } from '../../generated/prisma/client.js';

import { OrderStatus } from '../../generated/prisma/enums.js';

import { ChannelAccountsService } from '../../integrations/channel-accounts/channel-accounts.service.js';

import { PrismaService } from '../db/prisma.service.js';

import { ChannelHttpError } from '../http/channel-http.error.js';

import { OutboxService, type ClaimedOutboxMessage } from './outbox.service.js';

import {

  OUTBOX_TYPES,

  type OrderAcceptReturnPayload,

  type OrderCncDetailsPayload,

  type OrderCourierRangePayload,

  type OrderMarkingsPayload,

  type OrderTrackingPayload,

  type OrderTransitionPayload,

  type PriceUpdatePayload,

  type StocksPushPayload,

  type VasApplyPayload,

} from './outbox.types.js';



const BATCH_SIZE = 20;

const MAX_ATTEMPTS = 8;



const STATUS_AFTER_TRANSITION: Record<string, OrderStatus> = {

  confirm: OrderStatus.READY_TO_SHIP,

  reject: OrderStatus.CANCELED,

  perform: OrderStatus.IN_TRANSIT,

  receive: OrderStatus.DELIVERED,

};



@Injectable()

export class OutboxWorkerService {

  private readonly logger = new Logger(OutboxWorkerService.name);

  private running = false;



  constructor(

    private readonly outbox: OutboxService,

    private readonly accounts: ChannelAccountsService,

    private readonly registry: ChannelRegistry,

    private readonly prisma: PrismaService,

  ) {}



  @Interval(5_000)

  async tick(): Promise<void> {

    if (this.running) {

      return;

    }



    this.running = true;

    try {

      const batch = await this.outbox.claimPending(BATCH_SIZE);

      for (const message of batch) {

        await this.processOne(message);

      }

    } catch (error) {

      const text = error instanceof Error ? error.message : String(error);

      this.logger.error(`Сбой цикла outbox: ${text}`);

    } finally {

      this.running = false;

    }

  }



  private async processOne(message: ClaimedOutboxMessage): Promise<void> {

    try {

      if (message.type === OUTBOX_TYPES.STOCKS_PUSH) {

        await this.handleStocksPush(message);

      } else if (message.type === OUTBOX_TYPES.ORDER_TRANSITION) {

        await this.handleOrderTransition(message);

      } else if (message.type === OUTBOX_TYPES.ORDER_TRACKING) {

        await this.handleOrderTracking(message);

      } else if (message.type === OUTBOX_TYPES.ORDER_ACCEPT_RETURN) {

        await this.handleOrderAcceptReturn(message);

      } else if (message.type === OUTBOX_TYPES.ORDER_MARKINGS) {

        await this.handleOrderMarkings(message);

      } else if (message.type === OUTBOX_TYPES.ORDER_COURIER_RANGE) {

        await this.handleOrderCourierRange(message);

      } else if (message.type === OUTBOX_TYPES.ORDER_CNC_DETAILS) {

        await this.handleOrderCncDetails(message);

      } else if (message.type === OUTBOX_TYPES.PRICE_UPDATE) {

        await this.handlePriceUpdate(message);

      } else if (message.type === OUTBOX_TYPES.VAS_APPLY) {

        await this.handleVasApply(message);

      } else {

        throw new Error(`Неизвестный тип outbox: ${message.type}`);

      }



      await this.outbox.markDone(message.tenantId, message.id);

    } catch (error) {

      const text = error instanceof Error ? error.message : String(error);

      const permanent = isPermanentFailure(error) || message.attempts >= MAX_ATTEMPTS;

      const delayMs = Math.min(60_000, 2_000 * 2 ** Math.max(0, message.attempts - 1));



      this.logger.warn(

        `Outbox ${message.id} (${message.type}) attempt=${message.attempts}: ${text}`,

      );



      await this.outbox.markFailed(message.tenantId, message.id, text, {

        retry: !permanent,

        delayMs,

      });

    }

  }



  private async handleStocksPush(message: ClaimedOutboxMessage): Promise<void> {

    if (!message.channelAccountId) {

      throw new Error('stocks.push требует channelAccountId');

    }



    const payload = message.payload as unknown as StocksPushPayload;

    if (!payload?.items?.length) {

      return;

    }



    const account = await this.accounts.requireForTenant(

      message.tenantId,

      message.channelAccountId,

    );

    const adapter = this.registry.get(account.channel);



    if (!adapter.stocks || !adapter.capabilities.has(Capability.WRITE_STOCK)) {

      throw new Error(`Площадка ${account.channel} не умеет публиковать остатки`);

    }



    const items: StockQuantity[] = payload.items.map((item) => ({

      externalId: item.externalId,

      quantity: item.quantity,

    }));



    await adapter.stocks.pushStocks(

      { tenantId: message.tenantId, channelAccountId: message.channelAccountId },

      items,

    );

  }



  private async handleOrderTransition(message: ClaimedOutboxMessage): Promise<void> {

    if (!message.channelAccountId) {

      throw new Error('order.applyTransition требует channelAccountId');

    }



    const payload = message.payload as unknown as OrderTransitionPayload;

    const account = await this.accounts.requireForTenant(

      message.tenantId,

      message.channelAccountId,

    );

    const adapter = this.registry.get(account.channel);



    if (

      !adapter.orderTransitions ||

      !adapter.capabilities.has(Capability.TRANSITION_ORDERS)

    ) {

      throw new Error(`Площадка ${account.channel} не умеет менять статусы заказов`);

    }



    await adapter.orderTransitions.applyTransition(

      { tenantId: message.tenantId, channelAccountId: message.channelAccountId },

      {

        externalId: payload.externalId,

        transition: payload.transition,

        confirmCode: payload.confirmCode,

        marketplaceId: payload.marketplaceId,

      },

    );



    await this.applyLocalTransition(message.tenantId, payload.orderId, payload.transition);

  }



  private async handleOrderTracking(message: ClaimedOutboxMessage): Promise<void> {

    if (!message.channelAccountId) {

      throw new Error('order.setTrackingNumber требует channelAccountId');

    }



    const payload = message.payload as unknown as OrderTrackingPayload;

    const account = await this.accounts.requireForTenant(

      message.tenantId,

      message.channelAccountId,

    );

    const adapter = this.registry.get(account.channel);



    if (

      !adapter.orderTransitions ||

      !adapter.capabilities.has(Capability.TRANSITION_ORDERS)

    ) {

      throw new Error(`Площадка ${account.channel} не умеет передавать трек-номер`);

    }



    await adapter.orderTransitions.setTrackingNumber(

      { tenantId: message.tenantId, channelAccountId: message.channelAccountId },

      {

        externalId: payload.externalId,

        trackingNumber: payload.trackingNumber,

      },

    );



    await this.clearOrderActions(message.tenantId, payload.orderId, [

      'setTrackNumber',

      'fixTrackNumber',

    ]);

  }



  private async handleOrderAcceptReturn(message: ClaimedOutboxMessage): Promise<void> {

    if (!message.channelAccountId) {

      throw new Error('order.acceptReturn требует channelAccountId');

    }



    const payload = message.payload as unknown as OrderAcceptReturnPayload;

    const account = await this.accounts.requireForTenant(

      message.tenantId,

      message.channelAccountId,

    );

    const adapter = this.registry.get(account.channel);



    if (

      !adapter.orderTransitions?.acceptReturn ||

      !adapter.capabilities.has(Capability.TRANSITION_ORDERS)

    ) {

      throw new Error(`Площадка ${account.channel} не умеет принимать возвраты`);

    }



    await adapter.orderTransitions.acceptReturn(

      { tenantId: message.tenantId, channelAccountId: message.channelAccountId },

      {

        externalId: payload.externalId,

        terminalNumber: payload.terminalNumber,

        recipientName: payload.recipientName,

        recipientPhone: payload.recipientPhone,

      },

    );



    await this.clearOrderActions(message.tenantId, payload.orderId, ['acceptReturnOrder']);

  }



  private async handleOrderMarkings(message: ClaimedOutboxMessage): Promise<void> {

    if (!message.channelAccountId) {

      throw new Error('order.setMarkings требует channelAccountId');

    }



    const payload = message.payload as unknown as OrderMarkingsPayload;

    const account = await this.accounts.requireForTenant(

      message.tenantId,

      message.channelAccountId,

    );

    const adapter = this.registry.get(account.channel);



    if (!adapter.orderTransitions?.setMarkings) {

      throw new Error(`Площадка ${account.channel} не умеет передавать маркировки`);

    }



    await adapter.orderTransitions.setMarkings(

      { tenantId: message.tenantId, channelAccountId: message.channelAccountId },

      {

        externalId: payload.externalId,

        items: payload.items,

      },

    );



    await this.clearOrderActions(message.tenantId, payload.orderId, ['setMarkings']);

  }



  private async handleOrderCourierRange(message: ClaimedOutboxMessage): Promise<void> {

    if (!message.channelAccountId) {

      throw new Error('order.setCourierDeliveryRange требует channelAccountId');

    }



    const payload = message.payload as unknown as OrderCourierRangePayload;

    const account = await this.accounts.requireForTenant(

      message.tenantId,

      message.channelAccountId,

    );

    const adapter = this.registry.get(account.channel);



    if (!adapter.orderTransitions?.setCourierDeliveryRange) {

      throw new Error(`Площадка ${account.channel} не умеет выбирать окно курьера`);

    }



    await adapter.orderTransitions.setCourierDeliveryRange(

      { tenantId: message.tenantId, channelAccountId: message.channelAccountId },

      {

        externalId: payload.externalId,

        address: payload.address,

        addressDetails: payload.addressDetails,

        startDate: payload.startDate,

        endDate: payload.endDate,

        intervalType: payload.intervalType,

        phone: payload.phone,

        name: payload.name,

      },

    );



    await this.clearOrderActions(message.tenantId, payload.orderId, [

      'getCourierDeliveryRange',

      'setCourierDeliveryRange',

    ]);

  }



  private async handleOrderCncDetails(message: ClaimedOutboxMessage): Promise<void> {

    if (!message.channelAccountId) {

      throw new Error('order.setCncDetails требует channelAccountId');

    }



    const payload = message.payload as unknown as OrderCncDetailsPayload;

    const account = await this.accounts.requireForTenant(

      message.tenantId,

      message.channelAccountId,

    );

    const adapter = this.registry.get(account.channel);



    if (!adapter.orderTransitions?.setCncDetails) {

      throw new Error(`Площадка ${account.channel} не умеет готовить CNC`);

    }



    await adapter.orderTransitions.setCncDetails(

      { tenantId: message.tenantId, channelAccountId: message.channelAccountId },

      {

        externalId: payload.externalId,

        marketplaceId: payload.marketplaceId,

        bookingPeriod: payload.bookingPeriod,

        address: payload.address,

        details: payload.details,

      },

    );



    await this.clearOrderActions(message.tenantId, payload.orderId, ['setCNCDetails']);

  }



  private async handlePriceUpdate(message: ClaimedOutboxMessage): Promise<void> {

    if (!message.channelAccountId) {

      throw new Error('price.update требует channelAccountId');

    }



    const payload = message.payload as unknown as PriceUpdatePayload;

    const account = await this.accounts.requireForTenant(

      message.tenantId,

      message.channelAccountId,

    );

    const adapter = this.registry.get(account.channel);



    if (!adapter.prices || !adapter.capabilities.has(Capability.WRITE_PRICE)) {

      throw new Error(`Площадка ${account.channel} не умеет менять цену`);

    }



    await adapter.prices.updatePrice(

      { tenantId: message.tenantId, channelAccountId: message.channelAccountId },

      payload.externalId,

      payload.price,

    );



    await this.prisma.withTenant(message.tenantId, async (tx) => {

      await tx.channelListing.update({

        where: { id: payload.listingId },

        data: { price: payload.price },

      });

    });

  }



  private async handleVasApply(message: ClaimedOutboxMessage): Promise<void> {

    if (!message.channelAccountId) {

      throw new Error('vas.apply требует channelAccountId');

    }



    const payload = message.payload as unknown as VasApplyPayload;

    const account = await this.accounts.requireForTenant(

      message.tenantId,

      message.channelAccountId,

    );

    const adapter = this.registry.get(account.channel);



    if (!adapter.promotions) {

      throw new Error(`Площадка ${account.channel} не умеет применять продвижение`);

    }



    await adapter.promotions.applyVas(

      { tenantId: message.tenantId, channelAccountId: message.channelAccountId },

      {

        externalId: payload.externalId,

        slugs: payload.slugs,

        stickers: payload.stickers,

      },

    );

  }



  private async applyLocalTransition(

    tenantId: string,

    orderId: string,

    transition: string,

  ): Promise<void> {

    const nextStatus = STATUS_AFTER_TRANSITION[transition];

    if (!nextStatus) {

      return;

    }



    await this.prisma.withTenant(tenantId, async (tx) => {

      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) {

        return;

      }



      const actions = parseActions(order.availableActions).filter(

        (action) => action.name !== transition,

      );



      await tx.order.update({

        where: { id: orderId },

        data: {

          status: nextStatus,

          availableActions: actions as unknown as Prisma.InputJsonValue,

        },

      });

    });

  }



  private async clearOrderActions(

    tenantId: string,

    orderId: string,

    names: string[],

  ): Promise<void> {

    const blocked = new Set(names);



    await this.prisma.withTenant(tenantId, async (tx) => {

      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) {

        return;

      }



      const actions = parseActions(order.availableActions).filter(

        (action) => !blocked.has(action.name),

      );



      await tx.order.update({

        where: { id: orderId },

        data: {

          availableActions: actions as unknown as Prisma.InputJsonValue,

        },

      });

    });

  }

}



function parseActions(

  raw: Prisma.JsonValue | null | undefined,

): Array<{ name: string; required: boolean }> {

  if (!Array.isArray(raw)) {

    return [];

  }



  const result: Array<{ name: string; required: boolean }> = [];

  for (const item of raw) {

    if (!item || typeof item !== 'object') {

      continue;

    }

    const row = item as { name?: unknown; required?: unknown };

    if (typeof row.name !== 'string') {

      continue;

    }

    result.push({ name: row.name, required: Boolean(row.required) });

  }

  return result;

}



function isPermanentFailure(error: unknown): boolean {

  if (error instanceof ChannelHttpError) {

    return !error.isRetryable;

  }



  return false;

}


