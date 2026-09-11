import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentTenant } from './current-tenant.decorator.js';
import { TenantViewDto } from './tenants.dto.js';
import { TenantsService } from './tenants.service.js';

@ApiTags('Арендаторы')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Текущий арендатор' })
  @ApiOkResponse({ type: TenantViewDto })
  current(@CurrentTenant() tenantId: string): Promise<TenantViewDto | null> {
    return this.tenants.findById(tenantId);
  }
}
