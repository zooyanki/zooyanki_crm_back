import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

import { ChannelRegistry } from '../channels/channel.registry.js';
import { Capability } from '../channels/contracts/channel-adapter.js';
import { AppConfigService } from '../core/config/app-config.service.js';
import { PrismaService } from '../core/db/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AutoloadRunStatus, ListingStatus } from '../generated/prisma/enums.js';
import { ChannelAccountsService } from '../integrations/channel-accounts/channel-accounts.service.js';

const PENDING_EXTERNAL_PREFIX = 'pending:';

export interface AutoloadSettingsView {
  channelAccountId: string;
  feedUrl: string;
  category: string;
  goodsType: string | null;
  address: string;
  contactPhone: string | null;
  managerName: string | null;
  condition: string;
  descriptionFallback: string;
}

export interface UpdateAutoloadSettingsInput {
  category?: string;
  goodsType?: string | null;
  address?: string;
  contactPhone?: string | null;
  managerName?: string | null;
  condition?: string;
  descriptionFallback?: string;
}

export interface CreateFeedListingInput {
  channelAccountId: string;
  title: string;
  description: string;
  price: number;
  sku?: string;
}

export interface FeedListingView {
  id: string;
  channelAccountId: string;
  variantId: string | null;
  sku: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  externalId: string;
  avitoAdId: string | null;
  status: ListingStatus;
  createdAt: Date;
}

export interface AutoloadRunView {
  id: string;
  channelAccountId: string;
  status: AutoloadRunStatus;
  externalReportId: string | null;
  itemsTotal: number;
  itemsOk: number;
  itemsError: number;
  lastError: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface AutoloadItemView {
  id: string;
  adId: string;
  avitoId: string | null;
  section: string | null;
  sectionTitle: string | null;
  avitoStatus: string | null;
  url: string | null;
  messagesJson: unknown;
}

@Injectable()
export class AutoloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounts: ChannelAccountsService,
    private readonly registry: ChannelRegistry,
    private readonly config: AppConfigService,
  ) {}

  async getOrCreateSettings(
    tenantId: string,
    channelAccountId: string,
  ): Promise<AutoloadSettingsView> {
    await this.accounts.requireForTenant(tenantId, channelAccountId);

    const settings = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.autoloadSettings.findUnique({
        where: { channelAccountId },
      });
      if (existing) {
        return existing;
      }

      return tx.autoloadSettings.create({
        data: {
          tenantId,
          channelAccountId,
          feedToken: randomBytes(24).toString('hex'),
        },
      });
    });

    return toSettingsView(settings, this.feedUrl(channelAccountId, settings.feedToken));
  }

  async updateSettings(
    tenantId: string,
    channelAccountId: string,
    input: UpdateAutoloadSettingsInput,
  ): Promise<AutoloadSettingsView> {
    await this.getOrCreateSettings(tenantId, channelAccountId);

    const updated = await this.prisma.withTenant(tenantId, (tx) =>
      tx.autoloadSettings.update({
        where: { channelAccountId },
        data: {
          ...(input.category !== undefined ? { category: input.category.trim() } : {}),
          ...(input.goodsType !== undefined
            ? { goodsType: input.goodsType?.trim() || null }
            : {}),
          ...(input.address !== undefined ? { address: input.address.trim() } : {}),
          ...(input.contactPhone !== undefined
            ? { contactPhone: input.contactPhone?.trim() || null }
            : {}),
          ...(input.managerName !== undefined
            ? { managerName: input.managerName?.trim() || null }
            : {}),
          ...(input.condition !== undefined ? { condition: input.condition.trim() } : {}),
          ...(input.descriptionFallback !== undefined
            ? { descriptionFallback: input.descriptionFallback.trim() }
            : {}),
        },
      }),
    );

    return toSettingsView(updated, this.feedUrl(channelAccountId, updated.feedToken));
  }

  /// Создаёт товар+вариант и черновик объявления для XML-фида (без AvitoId).
  async createFeedListing(
    tenantId: string,
    input: CreateFeedListingInput,
  ): Promise<FeedListingView> {
    await this.accounts.requireForTenant(tenantId, input.channelAccountId);
    await this.getOrCreateSettings(tenantId, input.channelAccountId);

    const title = input.title.trim();
    const description = input.description.trim();
    if (!title || !description) {
      throw new BadRequestException('Название и описание обязательны');
    }
    if (!Number.isFinite(input.price) || input.price < 0) {
      throw new BadRequestException('Цена должна быть числом ≥ 0');
    }

    const sku = normalizeSku(input.sku) || `sku-${randomBytes(4).toString('hex')}`;
    const externalId = `${PENDING_EXTERNAL_PREFIX}${sku}`;

    return this.prisma.withTenant(tenantId, async (tx) => {
      const skuTaken = await tx.variant.findUnique({
        where: { tenantId_sku: { tenantId, sku } },
      });
      if (skuTaken) {
        throw new ConflictException(`SKU уже занят: ${sku}`);
      }

      const pendingTaken = await tx.channelListing.findUnique({
        where: {
          channelAccountId_externalId: {
            channelAccountId: input.channelAccountId,
            externalId,
          },
        },
      });
      if (pendingTaken) {
        throw new ConflictException(`Позиция с Id ${sku} уже есть в фиде`);
      }

      const product = await tx.product.create({
        data: {
          tenantId,
          title,
          description,
        },
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

      const listing = await tx.channelListing.create({
        data: {
          tenantId,
          channelAccountId: input.channelAccountId,
          variantId: variant.id,
          externalId,
          avitoAdId: sku,
          title,
          price: input.price,
          currency: 'RUB',
          status: ListingStatus.UNKNOWN,
          rawStatus: 'feed_draft',
        },
      });

      return {
        id: listing.id,
        channelAccountId: listing.channelAccountId,
        variantId: listing.variantId,
        sku,
        title,
        description,
        price: Number(listing.price ?? input.price),
        currency: listing.currency,
        externalId: listing.externalId,
        avitoAdId: listing.avitoAdId,
        status: listing.status,
        createdAt: listing.createdAt,
      };
    });
  }

  async listFeedListings(
    tenantId: string,
    channelAccountId: string,
  ): Promise<FeedListingView[]> {
    await this.accounts.requireForTenant(tenantId, channelAccountId);

    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.channelListing.findMany({
        where: {
          channelAccountId,
          OR: [
            { externalId: { startsWith: PENDING_EXTERNAL_PREFIX } },
            { rawStatus: 'feed_draft' },
          ],
        },
        include: {
          variant: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );

    return rows.map((row) => ({
      id: row.id,
      channelAccountId: row.channelAccountId,
      variantId: row.variantId,
      sku: row.avitoAdId || row.variant?.sku || row.externalId.replace(PENDING_EXTERNAL_PREFIX, ''),
      title: row.title || row.variant?.title || row.variant?.product?.title || row.externalId,
      description: row.variant?.product?.description ?? null,
      price: row.price != null ? Number(row.price) : 0,
      currency: row.currency,
      externalId: row.externalId,
      avitoAdId: row.avitoAdId,
      status: row.status,
      createdAt: row.createdAt,
    }));
  }

  async buildFeedXml(channelAccountId: string, token: string): Promise<string> {
    const account = await this.accounts.findActiveById(channelAccountId);
    if (!account) {
      throw new NotFoundException('Аккаунт не найден');
    }

    const settings = await this.prisma.withTenant(account.tenantId, (tx) =>
      tx.autoloadSettings.findUnique({ where: { channelAccountId } }),
    );

    if (!settings || !tokensEqual(settings.feedToken, token)) {
      throw new UnauthorizedException('Неверный токен фида');
    }

    const listings = await this.prisma.withTenant(account.tenantId, (tx) =>
      tx.channelListing.findMany({
        where: {
          channelAccountId,
          OR: [
            { status: ListingStatus.ACTIVE },
            { externalId: { startsWith: PENDING_EXTERNAL_PREFIX } },
            { rawStatus: 'feed_draft' },
          ],
        },
        include: {
          variant: { include: { product: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 5000,
      }),
    );

    const ads = listings.map((listing) => {
      const adId = listing.avitoAdId || listing.variant?.sku || listing.externalId;
      const title = listing.title || listing.variant?.title || listing.variant?.product?.title || adId;
      const description =
        listing.variant?.product?.description ||
        settings.descriptionFallback ||
        title;
      const price = listing.price != null ? Math.round(Number(listing.price)) : 0;
      const avitoId = /^\d+$/.test(listing.externalId) ? listing.externalId : null;

      return {
        id: adId,
        avitoId,
        title: title.slice(0, 50),
        description: description.slice(0, 7500),
        price,
        category: settings.category,
        goodsType: settings.goodsType,
        address: settings.address,
        contactPhone: settings.contactPhone,
        managerName: settings.managerName,
        condition: settings.condition,
      };
    });

    // Ensure avitoAdId is persisted for stable Id linking
    await this.prisma.withTenant(account.tenantId, async (tx) => {
      for (const listing of listings) {
        const adId = listing.avitoAdId || listing.variant?.sku || listing.externalId;
        if (listing.avitoAdId !== adId) {
          await tx.channelListing.update({
            where: { id: listing.id },
            data: { avitoAdId: adId },
          });
        }
      }
    });

    return renderFeedXml(ads);
  }

  async triggerUpload(tenantId: string, channelAccountId: string): Promise<AutoloadRunView> {
    await this.getOrCreateSettings(tenantId, channelAccountId);
    const account = await this.accounts.requireForTenant(tenantId, channelAccountId);
    const adapter = this.registry.get(account.channel);

    if (!adapter.autoload || !adapter.capabilities.has(Capability.PUBLISH_LISTINGS)) {
      throw new BadRequestException('Площадка не поддерживает автозагрузку');
    }

    const publicBase = this.config.publicBaseUrl.replace(/\/$/, '');
    if (!publicBase.startsWith('https://') && process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Для автозагрузки нужен PUBLIC_BASE_URL с https://');
    }

    const run = await this.prisma.withTenant(tenantId, (tx) =>
      tx.autoloadRun.create({
        data: {
          tenantId,
          channelAccountId,
          status: AutoloadRunStatus.RUNNING,
        },
      }),
    );

    try {
      await adapter.autoload.triggerUpload({ tenantId, channelAccountId });

      // Небольшая пауза, затем тянем последний отчёт (Авито обрабатывает асинхронно).
      await sleep(3_000);
      const reportId = await adapter.autoload.getLastCompletedReportId({
        tenantId,
        channelAccountId,
      });

      if (!reportId) {
        const updated = await this.prisma.withTenant(tenantId, (tx) =>
          tx.autoloadRun.update({
            where: { id: run.id },
            data: {
              status: AutoloadRunStatus.COMPLETED,
              finishedAt: new Date(),
              lastError: 'Выгрузка запущена, отчёт пока не готов — обновите позже',
            },
          }),
        );
        return toRunView(updated);
      }

      return this.pullReport(tenantId, channelAccountId, run.id, reportId);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      const updated = await this.prisma.withTenant(tenantId, (tx) =>
        tx.autoloadRun.update({
          where: { id: run.id },
          data: {
            status: AutoloadRunStatus.FAILED,
            finishedAt: new Date(),
            lastError: text,
          },
        }),
      );
      return toRunView(updated);
    }
  }

  async refreshLastReport(
    tenantId: string,
    channelAccountId: string,
  ): Promise<AutoloadRunView> {
    const account = await this.accounts.requireForTenant(tenantId, channelAccountId);
    const adapter = this.registry.get(account.channel);
    if (!adapter.autoload) {
      throw new BadRequestException('Площадка не поддерживает автозагрузку');
    }

    const reportId = await adapter.autoload.getLastCompletedReportId({
      tenantId,
      channelAccountId,
    });
    if (!reportId) {
      throw new NotFoundException('Завершённый отчёт автозагрузки не найден');
    }

    const run = await this.prisma.withTenant(tenantId, (tx) =>
      tx.autoloadRun.create({
        data: {
          tenantId,
          channelAccountId,
          status: AutoloadRunStatus.RUNNING,
          externalReportId: reportId,
        },
      }),
    );

    return this.pullReport(tenantId, channelAccountId, run.id, reportId);
  }

  async listRuns(
    tenantId: string,
    channelAccountId: string,
  ): Promise<AutoloadRunView[]> {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.autoloadRun.findMany({
        where: { channelAccountId },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
    );
    return rows.map(toRunView);
  }

  async listRunItems(tenantId: string, runId: string): Promise<AutoloadItemView[]> {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.autoloadItemResult.findMany({
        where: { runId },
        orderBy: { createdAt: 'asc' },
        take: 1000,
      }),
    );

    return rows.map((row) => ({
      id: row.id,
      adId: row.adId,
      avitoId: row.avitoId,
      section: row.section,
      sectionTitle: row.sectionTitle,
      avitoStatus: row.avitoStatus,
      url: row.url,
      messagesJson: row.messagesJson,
    }));
  }

  private async pullReport(
    tenantId: string,
    channelAccountId: string,
    runId: string,
    reportId: string,
  ): Promise<AutoloadRunView> {
    const account = await this.accounts.requireForTenant(tenantId, channelAccountId);
    const adapter = this.registry.get(account.channel);
    if (!adapter.autoload) {
      throw new BadRequestException('Площадка не поддерживает автозагрузку');
    }

    const ctx = { tenantId, channelAccountId };
    const allItems: Array<{
      adId: string;
      avitoId: string | null;
      section: string | null;
      sectionTitle: string | null;
      avitoStatus: string | null;
      url: string | null;
      messages: Array<{ type?: string; code?: string; description?: string; title?: string }>;
    }> = [];
    for (let page = 0; page < 50; page += 1) {
      const batch = await adapter.autoload.getReportItems(ctx, reportId, page, 100);
      allItems.push(...batch.items);
      if (!batch.hasMore) {
        break;
      }
    }

    let itemsOk = 0;
    let itemsError = 0;

    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.autoloadItemResult.deleteMany({ where: { runId } });

      for (const item of allItems) {
        const hasErrorMessage = (item.messages?.length ?? 0) > 0;
        const isErrorSection = Boolean(item.section && /error|fail|reject/i.test(item.section));
        const isError = isErrorSection || hasErrorMessage;

        if (isError) {
          itemsError += 1;
        } else {
          itemsOk += 1;
        }

        await tx.autoloadItemResult.create({
          data: {
            tenantId,
            runId,
            adId: item.adId,
            avitoId: item.avitoId,
            section: item.section,
            sectionTitle: item.sectionTitle,
            avitoStatus: item.avitoStatus,
            url: item.url,
            messagesJson: item.messages as Prisma.InputJsonValue,
          },
        });

        if (item.avitoId) {
          await tx.channelListing.updateMany({
            where: {
              channelAccountId,
              OR: [{ avitoAdId: item.adId }, { externalId: item.avitoId }],
            },
            data: {
              externalId: item.avitoId,
              avitoAdId: item.adId,
              rawStatus: null,
              ...(item.url ? { url: item.url } : {}),
              lastError:
                item.messages?.length
                  ? item.messages.map((m) => m.description ?? m.title ?? '').join('; ').slice(0, 500)
                  : null,
            },
          });
        }
      }

      // Дополнительно связываем ad_id -> avito_id пачкой
      const adIds = allItems.map((item) => item.adId).filter(Boolean);
      if (adapter.autoload && adIds.length > 0) {
        const links = await adapter.autoload.resolveAvitoIds(ctx, adIds.slice(0, 100));
        for (const link of links) {
          if (!link.adId || !link.avitoId) continue;
          await tx.channelListing.updateMany({
            where: { channelAccountId, avitoAdId: link.adId },
            data: { externalId: link.avitoId },
          });
        }
      }

      return tx.autoloadRun.update({
        where: { id: runId },
        data: {
          status: AutoloadRunStatus.COMPLETED,
          externalReportId: reportId,
          itemsTotal: allItems.length,
          itemsOk,
          itemsError,
          finishedAt: new Date(),
          lastError: null,
        },
      });
    });

    const run = await this.prisma.withTenant(tenantId, (tx) =>
      tx.autoloadRun.findUniqueOrThrow({ where: { id: runId } }),
    );
    return toRunView(run);
  }

  private feedUrl(channelAccountId: string, feedToken: string): string {
    const base = this.config.publicBaseUrl.replace(/\/$/, '') || 'http://localhost:3000';
    return `${base}/api/public/feeds/${channelAccountId}.xml?token=${feedToken}`;
  }
}

function tokensEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
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

function toSettingsView(
  row: {
    channelAccountId: string;
    category: string;
    goodsType: string | null;
    address: string;
    contactPhone: string | null;
    managerName: string | null;
    condition: string;
    descriptionFallback: string;
    feedToken: string;
  },
  feedUrl: string,
): AutoloadSettingsView {
  return {
    channelAccountId: row.channelAccountId,
    feedUrl,
    category: row.category,
    goodsType: row.goodsType,
    address: row.address,
    contactPhone: row.contactPhone,
    managerName: row.managerName,
    condition: row.condition,
    descriptionFallback: row.descriptionFallback,
  };
}

function toRunView(row: {
  id: string;
  channelAccountId: string;
  status: AutoloadRunStatus;
  externalReportId: string | null;
  itemsTotal: number;
  itemsOk: number;
  itemsError: number;
  lastError: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}): AutoloadRunView {
  return {
    id: row.id,
    channelAccountId: row.channelAccountId,
    status: row.status,
    externalReportId: row.externalReportId,
    itemsTotal: row.itemsTotal,
    itemsOk: row.itemsOk,
    itemsError: row.itemsError,
    lastError: row.lastError,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function renderFeedXml(
  ads: Array<{
    id: string;
    avitoId: string | null;
    title: string;
    description: string;
    price: number;
    category: string;
    goodsType: string | null;
    address: string;
    contactPhone: string | null;
    managerName: string | null;
    condition: string;
  }>,
): string {
  const body = ads
    .map((ad) => {
      const lines = [
        '  <Ad>',
        `    <Id>${escapeXml(ad.id)}</Id>`,
        ad.avitoId ? `    <AvitoId>${escapeXml(ad.avitoId)}</AvitoId>` : null,
        `    <Category>${escapeXml(ad.category)}</Category>`,
        ad.goodsType ? `    <GoodsType>${escapeXml(ad.goodsType)}</GoodsType>` : null,
        `    <Address>${escapeXml(ad.address)}</Address>`,
        ad.contactPhone ? `    <ContactPhone>${escapeXml(ad.contactPhone)}</ContactPhone>` : null,
        ad.managerName ? `    <ManagerName>${escapeXml(ad.managerName)}</ManagerName>` : null,
        `    <Title>${escapeXml(ad.title)}</Title>`,
        `    <Description><![CDATA[${ad.description}]]></Description>`,
        `    <Price>${ad.price}</Price>`,
        `    <Condition>${escapeXml(ad.condition)}</Condition>`,
        '  </Ad>',
      ];
      return lines.filter(Boolean).join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<Ads formatVersion="3" target="Avito.ru">\n${body}\n</Ads>\n`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

