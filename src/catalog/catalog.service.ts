import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { ChannelCode, ListingStatus } from '../generated/prisma/enums.js';
import { PrismaService, type TransactionClient } from '../core/db/prisma.service.js';
import { ChannelAccountsService } from '../integrations/channel-accounts/channel-accounts.service.js';

const PENDING_EXTERNAL_PREFIX = 'pending:';

export interface CatalogPublication {
  listingId: string;
  channel: ChannelCode;
  channelAccountId: string;
  externalId: string;
  status: ListingStatus;
  url: string | null;
}

export interface CatalogItem {
  variantId: string;
  productId: string;
  sku: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  publications: CatalogPublication[];
  updatedAt: Date;
}

export interface CatalogListResult {
  items: CatalogItem[];
  total: number;
  page: number;
  perPage: number;
}

export interface CreateCatalogItemInput {
  title: string;
  description: string;
  price: number;
  sku?: string;
  channelAccountIds: string[];
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: ChannelAccountsService,
  ) {}

  async list(
    tenantId: string,
    query: { status?: ListingStatus; page: number; perPage: number },
  ): Promise<CatalogListResult> {
    const status = query.status ?? ListingStatus.ACTIVE;

    return this.prisma.withTenant(tenantId, async (tx) => {
      await this.backfillOrphanListings(tx, tenantId);

      const where = {
        listings: { some: { status } },
      };

      const [rows, total] = await Promise.all([
        tx.variant.findMany({
          where,
          include: {
            product: true,
            listings: {
              include: { channelAccount: { select: { channel: true } } },
              orderBy: { updatedAt: 'desc' },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip: (query.page - 1) * query.perPage,
          take: query.perPage,
        }),
        tx.variant.count({ where }),
      ]);

      return {
        items: rows.map((row) => toCatalogItem(row)),
        total,
        page: query.page,
        perPage: query.perPage,
      };
    });
  }

  async listVariantOptions(tenantId: string): Promise<Array<{ variantId: string; sku: string; title: string }>> {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.variant.findMany({
        include: { product: true },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      }),
    );

    return rows.map((row) => ({
      variantId: row.id,
      sku: row.sku,
      title: row.title ?? row.product.title,
    }));
  }

  async create(tenantId: string, input: CreateCatalogItemInput): Promise<CatalogItem> {
    const title = input.title.trim();
    const description = input.description.trim();
    if (!title || !description) {
      throw new BadRequestException('Название и описание обязательны');
    }
    if (!Number.isFinite(input.price) || input.price < 0) {
      throw new BadRequestException('Цена должна быть числом ≥ 0');
    }
    if (input.channelAccountIds.length === 0) {
      throw new BadRequestException('Выберите хотя бы одну площадку');
    }

    const uniqueAccountIds = [...new Set(input.channelAccountIds)];
    const sku = normalizeSku(input.sku) || `sku-${randomBytes(4).toString('hex')}`;

    for (const accountId of uniqueAccountIds) {
      await this.accounts.requireForTenant(tenantId, accountId);
    }

    return this.prisma.withTenant(tenantId, async (tx) => {
      const skuTaken = await tx.variant.findUnique({
        where: { tenantId_sku: { tenantId, sku } },
      });
      if (skuTaken) {
        throw new ConflictException(`SKU уже занят: ${sku}`);
      }

      const product = await tx.product.create({
        data: { tenantId, title, description },
      });

      const variant = await tx.variant.create({
        data: {
          tenantId,
          productId: product.id,
          sku,
          title,
          price: input.price,
          currency: 'RUB',
        },
      });

      for (const channelAccountId of uniqueAccountIds) {
        const account = await tx.channelAccount.findUnique({
          where: { id: channelAccountId },
        });
        if (!account) {
          throw new NotFoundException(`Аккаунт ${channelAccountId} не найден`);
        }

        const externalId = `${PENDING_EXTERNAL_PREFIX}${account.channel.toLowerCase()}:${sku}`;
        await tx.channelListing.create({
          data: {
            tenantId,
            channelAccountId,
            variantId: variant.id,
            externalId,
            avitoAdId: account.channel === ChannelCode.AVITO ? sku : null,
            title,
            price: input.price,
            currency: 'RUB',
            status: ListingStatus.UNKNOWN,
            rawStatus: 'feed_draft',
          },
        });
      }

      const created = await tx.variant.findUniqueOrThrow({
        where: { id: variant.id },
        include: {
          product: true,
          listings: {
            include: { channelAccount: { select: { channel: true } } },
          },
        },
      });

      return toCatalogItem(created);
    });
  }

  async attachListing(
    tenantId: string,
    listingId: string,
    variantId: string,
  ): Promise<CatalogItem> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const listing = await tx.channelListing.findUnique({
        where: { id: listingId },
        include: { channelAccount: { select: { channel: true } } },
      });
      if (!listing) {
        throw new NotFoundException(`Объявление ${listingId} не найдено`);
      }

      const variant = await tx.variant.findUnique({
        where: { id: variantId },
        include: {
          product: true,
          listings: {
            include: { channelAccount: { select: { channel: true } } },
          },
        },
      });
      if (!variant) {
        throw new NotFoundException(`Товар ${variantId} не найден`);
      }

      if (listing.variantId === variantId) {
        return toCatalogItem(variant);
      }

      const alreadyOnChannel = variant.listings.some(
        (row) => row.channelAccount.channel === listing.channelAccount.channel,
      );
      if (alreadyOnChannel) {
        throw new ConflictException(
          'Этот товар уже есть на этой площадке. Присвойте объявление с другой площадки.',
        );
      }

      await tx.channelListing.update({
        where: { id: listingId },
        data: { variantId },
      });

      const updated = await tx.variant.findUniqueOrThrow({
        where: { id: variantId },
        include: {
          product: true,
          listings: {
            include: { channelAccount: { select: { channel: true } } },
          },
        },
      });

      return toCatalogItem(updated);
    });
  }

  private async backfillOrphanListings(tx: TransactionClient, tenantId: string): Promise<void> {
    const orphans = await tx.channelListing.findMany({
      where: { variantId: null },
      include: { channelAccount: { select: { channel: true } } },
      take: 500,
    });

    for (const listing of orphans) {
      const variantId = await ensureVariantForListing(tx, tenantId, listing);
      await tx.channelListing.update({
        where: { id: listing.id },
        data: { variantId },
      });
    }
  }
}

export async function ensureVariantForListing(
  tx: TransactionClient,
  tenantId: string,
  listing: {
    id: string;
    externalId: string;
    title: string | null;
    price: unknown;
    currency: string;
    channelAccount: { channel: ChannelCode };
  },
): Promise<string> {
  const prefix = listing.channelAccount.channel.toLowerCase();
  const sku = `${prefix}-${listing.externalId}`.slice(0, 64);

  const existing = await tx.variant.findUnique({
    where: { tenantId_sku: { tenantId, sku } },
  });
  if (existing) {
    return existing.id;
  }

  const product = await tx.product.create({
    data: {
      tenantId,
      title: listing.title ?? `Объявление ${listing.externalId}`,
    },
  });

  const variant = await tx.variant.create({
    data: {
      tenantId,
      productId: product.id,
      sku,
      title: listing.title,
      price: listing.price as never,
      currency: listing.currency,
    },
  });

  return variant.id;
}

function toCatalogItem(
  row: {
    id: string;
    productId: string;
    sku: string;
    title: string | null;
    price: unknown;
    currency: string;
    updatedAt: Date;
    product: { title: string; description: string | null };
    listings: Array<{
      id: string;
      externalId: string;
      status: ListingStatus;
      url: string | null;
      channelAccountId: string;
      channelAccount: { channel: ChannelCode };
    }>;
  },
): CatalogItem {
  const publications = row.listings.map((listing) => ({
      listingId: listing.id,
      channel: listing.channelAccount.channel,
      channelAccountId: listing.channelAccountId,
      externalId: listing.externalId,
      status: listing.status,
      url: listing.url,
    }));

  return {
    variantId: row.id,
    productId: row.productId,
    sku: row.sku,
    title: row.title ?? row.product.title,
    description: row.product.description,
    price: row.price != null ? Number(row.price) : null,
    currency: row.currency,
    publications,
    updatedAt: row.updatedAt,
  };
}

function normalizeSku(raw?: string): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 64);
  return cleaned || null;
}
