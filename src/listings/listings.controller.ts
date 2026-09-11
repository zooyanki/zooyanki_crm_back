import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import { ListingListResultDto, ListListingsQueryDto } from './listings.dto.js';
import { ListingsService } from './listings.service.js';

@ApiTags('Объявления')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
