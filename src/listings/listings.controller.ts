import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { ListingStatus } from '../generated/prisma/enums.js';
import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import { TENANT_HEADER, TenantGuard } from '../tenancy/tenant.guard.js';
import { ListingsService, type ListingListResult } from './listings.service.js';

export class ListListingsQueryDto {
  @IsOptional()
  @IsUUID()
  channelAccountId?: string;

  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 50;
}

@ApiTags('Объявления')
@ApiHeader({ name: TENANT_HEADER, required: true })
@UseGuards(TenantGuard)
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @ApiOperation({ summary: 'Список объявлений всех подключённых площадок' })
  list(
    @CurrentTenant() tenantId: string,
    @Query() query: ListListingsQueryDto,
  ): Promise<ListingListResult> {
    return this.listings.list(tenantId, query);
  }
}
