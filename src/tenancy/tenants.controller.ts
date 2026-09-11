import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentTenant } from './current-tenant.decorator.js';
import { TENANT_HEADER, TenantGuard } from './tenant.guard.js';
import { CreateTenantDto, TenantViewDto } from './tenants.dto.js';
import { TenantsService } from './tenants.service.js';

@ApiTags('Арендаторы')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Создать арендатора' })
  @ApiOkResponse({ type: TenantViewDto })
  create(@Body() dto: CreateTenantDto): Promise<TenantViewDto> {
    return this.tenants.create(dto.name);
  }

  @Get('current')
  @UseGuards(TenantGuard)
  @ApiHeader({ name: TENANT_HEADER, required: true })
  @ApiOperation({ summary: 'Текущий арендатор' })
  @ApiOkResponse({ type: TenantViewDto })
  current(@CurrentTenant() tenantId: string): Promise<TenantViewDto | null> {
    return this.tenants.findById(tenantId);
  }
}
