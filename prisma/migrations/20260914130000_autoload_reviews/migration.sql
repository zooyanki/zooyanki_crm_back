-- CreateEnum
CREATE TYPE "autoload_run_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "autoload_settings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channelAccountId" UUID NOT NULL,
    "feedToken" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Запчасти и аксессуары',
    "goodsType" TEXT,
    "address" TEXT NOT NULL DEFAULT 'Россия',
    "contactPhone" TEXT,
    "managerName" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'Новое',
    "descriptionFallback" TEXT NOT NULL DEFAULT 'Описание уточняйте у продавца',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "autoload_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoload_runs" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channelAccountId" UUID NOT NULL,
    "status" "autoload_run_status" NOT NULL DEFAULT 'PENDING',
    "externalReportId" TEXT,
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "itemsOk" INTEGER NOT NULL DEFAULT 0,
    "itemsError" INTEGER NOT NULL DEFAULT 0,
    "summaryJson" JSONB,
    "lastError" TEXT,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "autoload_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoload_item_results" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "adId" TEXT NOT NULL,
    "avitoId" TEXT,
    "section" TEXT,
    "sectionTitle" TEXT,
    "avitoStatus" TEXT,
    "url" TEXT,
    "messagesJson" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autoload_item_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channelAccountId" UUID NOT NULL,
    "channel" "channel_code" NOT NULL,
    "externalId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "text" TEXT,
    "stage" TEXT,
    "canAnswer" BOOLEAN NOT NULL DEFAULT false,
    "itemExternalId" TEXT,
    "itemTitle" TEXT,
    "authorName" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "answerExternalId" TEXT,
    "answerText" TEXT,
    "syncedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "autoload_settings_channelAccountId_key" ON "autoload_settings"("channelAccountId");
CREATE INDEX "autoload_settings_tenantId_idx" ON "autoload_settings"("tenantId");
CREATE INDEX "autoload_runs_tenantId_startedAt_idx" ON "autoload_runs"("tenantId", "startedAt");
CREATE INDEX "autoload_runs_channelAccountId_startedAt_idx" ON "autoload_runs"("channelAccountId", "startedAt");
CREATE INDEX "autoload_item_results_runId_idx" ON "autoload_item_results"("runId");
CREATE INDEX "autoload_item_results_tenantId_adId_idx" ON "autoload_item_results"("tenantId", "adId");
CREATE UNIQUE INDEX "reviews_channelAccountId_externalId_key" ON "reviews"("channelAccountId", "externalId");
CREATE INDEX "reviews_tenantId_publishedAt_idx" ON "reviews"("tenantId", "publishedAt");

-- FKs
ALTER TABLE "autoload_settings" ADD CONSTRAINT "autoload_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "autoload_settings" ADD CONSTRAINT "autoload_settings_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "autoload_runs" ADD CONSTRAINT "autoload_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "autoload_runs" ADD CONSTRAINT "autoload_runs_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "autoload_item_results" ADD CONSTRAINT "autoload_item_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "autoload_item_results" ADD CONSTRAINT "autoload_item_results_runId_fkey" FOREIGN KEY ("runId") REFERENCES "autoload_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "autoload_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "autoload_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "autoload_settings"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

ALTER TABLE "autoload_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "autoload_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "autoload_runs"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

ALTER TABLE "autoload_item_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "autoload_item_results" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "autoload_item_results"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "reviews"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

