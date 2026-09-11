import { Module } from '@nestjs/common';

import { TenantGuard } from './tenant.guard.js';
import { TenantsController } from './tenants.controller.js';
import { TenantsService } from './tenants.service.js';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, TenantGuard],
  exports: [TenantsService, TenantGuard],
})
export class TenancyModule {}
