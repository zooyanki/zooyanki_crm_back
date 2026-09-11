-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "channel_code" AS ENUM ('AVITO', 'OZON', 'WILDBERRIES', 'DROM');

-- CreateEnum
CREATE TYPE "auth_type" AS ENUM ('CLIENT_CREDENTIALS', 'AUTHORIZATION_CODE');

-- CreateEnum
CREATE TYPE "channel_account_status" AS ENUM ('PENDING', 'ACTIVE', 'INVALID_CREDENTIALS', 'DISABLED');

-- CreateEnum
CREATE TYPE "listing_status" AS ENUM ('ACTIVE', 'BLOCKED', 'ARCHIVED', 'REJECTED', 'REMOVED', 'OLD', 'UNKNOWN');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "member_role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_accounts" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channel" "channel_code" NOT NULL,
    "title" TEXT NOT NULL,
    "authType" "auth_type" NOT NULL DEFAULT 'CLIENT_CREDENTIALS',
    "credentialsEncrypted" TEXT NOT NULL,
    "externalUserId" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "channel_account_status" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "lastSyncAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "channel_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" UUID NOT NULL,
    "channelAccountId" UUID NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variants" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "title" TEXT,
    "price" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_listings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channelAccountId" UUID NOT NULL,
    "variantId" UUID,
    "externalId" TEXT NOT NULL,
    "avitoAdId" TEXT,
    "title" TEXT,
    "url" TEXT,
    "price" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "categoryId" TEXT,
    "status" "listing_status" NOT NULL DEFAULT 'UNKNOWN',
    "rawStatus" TEXT,
    "lastError" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "syncedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "channel_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stats_daily" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channelAccountId" UUID NOT NULL,
    "listingId" UUID,
    "variantId" UUID,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "contacts" INTEGER NOT NULL DEFAULT 0,
    "favorites" INTEGER NOT NULL DEFAULT 0,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "spending" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stats_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_states" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "channelAccountId" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "cursor" TEXT,
    "lastRunAt" TIMESTAMPTZ(3),
    "lastSuccessAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_call_log" (
    "id" UUID NOT NULL,
    "tenantId" UUID,
    "channelAccountId" UUID,
    "channel" "channel_code" NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "statusCode" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "errorText" TEXT,
    "requestSnippet" TEXT,
    "responseSnippet" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_call_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_userId_idx" ON "memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenantId_userId_key" ON "memberships"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "channel_accounts_tenantId_channel_idx" ON "channel_accounts"("tenantId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "channel_accounts_tenantId_channel_externalUserId_key" ON "channel_accounts"("tenantId", "channel", "externalUserId");

-- CreateIndex
CREATE INDEX "oauth_tokens_channelAccountId_expiresAt_idx" ON "oauth_tokens"("channelAccountId", "expiresAt");

-- CreateIndex
CREATE INDEX "products_tenantId_idx" ON "products"("tenantId");

-- CreateIndex
CREATE INDEX "variants_productId_idx" ON "variants"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "variants_tenantId_sku_key" ON "variants"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "channel_listings_tenantId_status_idx" ON "channel_listings"("tenantId", "status");

-- CreateIndex
CREATE INDEX "channel_listings_variantId_idx" ON "channel_listings"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_listings_channelAccountId_externalId_key" ON "channel_listings"("channelAccountId", "externalId");

-- CreateIndex
CREATE INDEX "stats_daily_tenantId_date_idx" ON "stats_daily"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "stats_daily_channelAccountId_listingId_date_key" ON "stats_daily"("channelAccountId", "listingId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "sync_states_channelAccountId_entity_key" ON "sync_states"("channelAccountId", "entity");

-- CreateIndex
CREATE INDEX "api_call_log_channelAccountId_createdAt_idx" ON "api_call_log"("channelAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "api_call_log_endpoint_createdAt_idx" ON "api_call_log"("endpoint", "createdAt");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_accounts" ADD CONSTRAINT "channel_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_listings" ADD CONSTRAINT "channel_listings_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stats_daily" ADD CONSTRAINT "stats_daily_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stats_daily" ADD CONSTRAINT "stats_daily_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stats_daily" ADD CONSTRAINT "stats_daily_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "channel_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stats_daily" ADD CONSTRAINT "stats_daily_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_states" ADD CONSTRAINT "sync_states_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_states" ADD CONSTRAINT "sync_states_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_call_log" ADD CONSTRAINT "api_call_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_call_log" ADD CONSTRAINT "api_call_log_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "channel_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
