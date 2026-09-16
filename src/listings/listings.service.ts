import {

  BadRequestException,

  Injectable,

  NotFoundException,

} from '@nestjs/common';



import { ChannelRegistry } from '../channels/channel.registry.js';

import { Capability } from '../channels/contracts/channel-adapter.js';

import type { Prisma } from '../generated/prisma/client.js';

import type { ChannelCode, ListingStatus } from '../generated/prisma/enums.js';

import { ChannelAccountsService } from '../integrations/channel-accounts/channel-accounts.service.js';

import { PrismaService } from '../core/db/prisma.service.js';

import { OutboxService } from '../core/outbox/outbox.service.js';

import {

  OUTBOX_TYPES,

  type PriceUpdatePayload,

  type VasApplyPayload,

} from '../core/outbox/outbox.types.js';



export interface ListingView {

  id: string;

  channel: ChannelCode;

  channelAccountId: string;

  externalId: string;

  title: string | null;

  url: string | null;

  price: number | null;

  currency: string;

  status: ListingStatus;

  publishedAt: Date | null;

  syncedAt: Date | null;

}



export interface ListingListQuery {

  channelAccountId?: string;

  status?: ListingStatus;

  page: number;

  perPage: number;

}



export interface ListingListResult {

  items: ListingView[];

  total: number;

  page: number;

  perPage: number;

}



export interface QueuedListingActionResult {

  queued: true;

  listingId: string;

}



export interface VasOfferView {

  externalId: string;

  vas: Array<{ slug: string; price: number; priceOld?: number }>;

  stickers: Array<{ id: number; title?: string; description?: string }>;

}



@Injectable()

export class ListingsService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly outbox: OutboxService,

    private readonly accounts: ChannelAccountsService,

    private readonly registry: ChannelRegistry,

  ) {}



  async list(tenantId: string, query: ListingListQuery): Promise<ListingListResult> {

    const where = {

      ...(query.channelAccountId ? { channelAccountId: query.channelAccountId } : {}),

      ...(query.status ? { status: query.status } : {}),

    };



    return this.prisma.withTenant(tenantId, async (tx) => {

      const [rows, total] = await Promise.all([

        tx.channelListing.findMany({

          where,

          include: { channelAccount: { select: { channel: true } } },

          // Сортируем по моменту первого импорта: Авито не отдаёт дату

          // публикации в списке объявлений, так что publishedAt там пуст.

          orderBy: { createdAt: 'desc' },

          skip: (query.page - 1) * query.perPage,

          take: query.perPage,

        }),

        tx.channelListing.count({ where }),

      ]);



      return {

        items: rows.map((row) => ({

          id: row.id,

          channel: row.channelAccount.channel,

          channelAccountId: row.channelAccountId,

          externalId: row.externalId,

          title: row.title,

          url: row.url,

          price: row.price === null ? null : Number(row.price),

          currency: row.currency,

          status: row.status,

          publishedAt: row.publishedAt,

          syncedAt: row.syncedAt,

        })),

        total,

        page: query.page,

        perPage: query.perPage,

      };

    });

  }



  /// Идентификаторы объявлений на площадке — нужны синхронизации статистики,

  /// которая запрашивает метрики пачками по external_id.

  async externalIds(tenantId: string, channelAccountId: string): Promise<string[]> {

    const rows = await this.prisma.withTenant(tenantId, (tx) =>

      tx.channelListing.findMany({

        where: { channelAccountId },

        select: { externalId: true },

      }),

    );



    return rows.map((row) => row.externalId);

  }



  async queuePriceUpdate(

    tenantId: string,

    listingId: string,

    price: number,

  ): Promise<QueuedListingActionResult> {

    if (!Number.isFinite(price) || price < 0) {

      throw new BadRequestException('Цена должна быть неотрицательным числом');

    }



    const listing = await this.requireListing(tenantId, listingId);

    const account = await this.accounts.requireForTenant(tenantId, listing.channelAccountId);

    const adapter = this.registry.get(account.channel);



    if (!adapter.prices || !adapter.capabilities.has(Capability.WRITE_PRICE)) {

      throw new BadRequestException('Площадка не поддерживает смену цены');

    }



    const payload = {

      listingId: listing.id,

      externalId: listing.externalId,

      price: Math.round(price),

    } satisfies PriceUpdatePayload;



    await this.outbox.enqueue({

      tenantId,

      channelAccountId: listing.channelAccountId,

      type: OUTBOX_TYPES.PRICE_UPDATE,

      payload: payload as Prisma.InputJsonValue,

      idempotencyKey: `price:${listing.id}:${payload.price}:${Date.now()}`,

    });



    return { queued: true, listingId: listing.id };

  }



  async vasPrices(tenantId: string, listingId: string): Promise<VasOfferView> {

    const listing = await this.requireListing(tenantId, listingId);

    const account = await this.accounts.requireForTenant(tenantId, listing.channelAccountId);

    const adapter = this.registry.get(account.channel);



    if (!adapter.promotions) {

      throw new BadRequestException('Площадка не поддерживает услуги продвижения');

    }



    const offers = await adapter.promotions.fetchVasPrices(

      { tenantId, channelAccountId: listing.channelAccountId },

      [listing.externalId],

    );



    return (

      offers[0] ?? {

        externalId: listing.externalId,

        vas: [],

        stickers: [],

      }

    );

  }



  async queueVasApply(

    tenantId: string,

    listingId: string,

    slugs: string[],

    stickers?: number[],

  ): Promise<QueuedListingActionResult> {

    const uniqueSlugs = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];

    if (uniqueSlugs.length === 0) {

      throw new BadRequestException('Выберите хотя бы одну услугу');

    }



    const listing = await this.requireListing(tenantId, listingId);

    const account = await this.accounts.requireForTenant(tenantId, listing.channelAccountId);

    const adapter = this.registry.get(account.channel);



    if (!adapter.promotions) {

      throw new BadRequestException('Площадка не поддерживает услуги продвижения');

    }



    const payload = {

      listingId: listing.id,

      externalId: listing.externalId,

      slugs: uniqueSlugs,

      stickers: stickers?.length ? stickers : undefined,

    } satisfies VasApplyPayload;



    await this.outbox.enqueue({

      tenantId,

      channelAccountId: listing.channelAccountId,

      type: OUTBOX_TYPES.VAS_APPLY,

      payload: payload as Prisma.InputJsonValue,

      idempotencyKey: `vas:${listing.id}:${uniqueSlugs.sort().join(',')}:${Date.now()}`,

    });



    return { queued: true, listingId: listing.id };

  }



  private async requireListing(tenantId: string, listingId: string) {

    const listing = await this.prisma.withTenant(tenantId, (tx) =>

      tx.channelListing.findUnique({ where: { id: listingId } }),

    );



    if (!listing) {

      throw new NotFoundException(`Объявление ${listingId} не найдено`);

    }



    return listing;

  }

}


