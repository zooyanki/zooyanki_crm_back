import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import { TENANT_HEADER, TenantGuard } from '../tenancy/tenant.guard.js';
import { ListingListResultDto, ListListingsQueryDto } from './listings.dto.js';
import { ListingsService } from './listings.service.js';

@ApiTags('Объявления')
@ApiHeader({ name: TENANT_HEADER, required: true })
@UseGuards(TenantGuard)
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @ApiOperation({ summary: 'Список объявлений всех подключённых площадок' })
  @ApiOkResponse({ type: ListingListResultDto })
  list(
    @CurrentTenant() tenantId: string,
    @Query() query: ListListingsQueryDto,
  ): Promise<ListingListResultDto> {
    return this.listings.list(tenantId, query);
  }
}
