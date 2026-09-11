import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { CurrentTenant } from './current-tenant.decorator.js';
import { TenantGuard } from './tenant.guard.js';
import { TenantsService, type TenantView } from './tenants.service.js';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}

@ApiTags('Арендаторы')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Создать арендатора' })
  create(@Body() dto: CreateTenantDto): Promise<TenantView> {
    return this.tenants.create(dto.name);
  }

  @Get('current')
  @UseGuards(TenantGuard)
  @ApiOperation({ summary: 'Текущий арендатор' })
  current(@CurrentTenant() tenantId: string): Promise<TenantView | null> {
    return this.tenants.findById(tenantId);
  }
}
