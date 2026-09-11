-- Изоляция арендаторов на уровне базы.
--
-- Приложение подключается под владельцем таблиц, а владелец по умолчанию
-- обходит RLS, поэтому кроме ENABLE обязателен FORCE — иначе политики
-- не применятся и защита будет бутафорской.
--
-- Арендатор берётся из настройки app.tenant_id, которую ставит
-- PrismaService.withTenant(). Если настройка не задана, функция вернёт NULL,
-- сравнение даст NULL и строки не будут видны: поведение fail-closed.

CREATE OR REPLACE FUNCTION app_current_tenant_id() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

-- Таблица самих арендаторов: читать и менять можно только свою запись,
-- но создание разрешено без контекста — иначе первого арендатора
-- было бы невозможно завести.
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select" ON "tenants"
  FOR SELECT USING ("id" = app_current_tenant_id());
CREATE POLICY "tenants_insert" ON "tenants"
  FOR INSERT WITH CHECK (true);
CREATE POLICY "tenants_update" ON "tenants"
  FOR UPDATE USING ("id" = app_current_tenant_id());
CREATE POLICY "tenants_delete" ON "tenants"
  FOR DELETE USING ("id" = app_current_tenant_id());

-- Доменные таблицы: полная изоляция по tenantId.
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "memberships"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

ALTER TABLE "channel_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "channel_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "channel_accounts"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

ALTER TABLE "oauth_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "oauth_tokens"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "products"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

ALTER TABLE "variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "variants" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "variants"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

ALTER TABLE "channel_listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "channel_listings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "channel_listings"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

ALTER TABLE "stats_daily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stats_daily" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "stats_daily"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

ALTER TABLE "sync_states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sync_states" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "sync_states"
  USING ("tenantId" = app_current_tenant_id())
  WITH CHECK ("tenantId" = app_current_tenant_id());

-- Журнал вызовов пишется в том числе до того, как известен арендатор
-- (например, при получении токена), поэтому запись разрешена всегда,
-- а чтение ограничено своими и системными строками.
ALTER TABLE "api_call_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_call_log" FORCE ROW LEVEL SECURITY;
CREATE POLICY "api_call_log_insert" ON "api_call_log"
  FOR INSERT WITH CHECK (true);
CREATE POLICY "api_call_log_select" ON "api_call_log"
  FOR SELECT USING ("tenantId" IS NULL OR "tenantId" = app_current_tenant_id());

-- Таблица users намеренно без RLS: учётные записи глобальны и не принадлежат
-- арендатору, связь задаётся через memberships.
