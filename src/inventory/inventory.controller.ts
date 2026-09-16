import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import {
  AdjustInventoryDto,
  InventoryListResultDto,
  InventoryViewDto,
  ListInventoryQueryDto,
} from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('Склад')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Остатки по вариантам каталога' })
  @ApiOkResponse({ type: InventoryListResultDto })
  list(
    @CurrentTenant() tenantId: string,
    @Query() query: ListInventoryQueryDto,
  ): Promise<InventoryListResultDto> {
    return this.inventory.list(tenantId, query.page, query.perPage);
  }

  @Get('by-listing/:listingId')
  @ApiOperation({ summary: 'Остаток по объявлению (если уже есть в CRM)' })
  @ApiOkResponse({ type: InventoryViewDto })
  async byListing(
    @CurrentTenant() tenantId: string,
    @Param('listingId') listingId: string,
  ): Promise<InventoryViewDto | null> {
    return this.inventory.getByListingId(tenantId, listingId);
  }

  @Post('adjust')
  @ApiOperation({
    summary: 'Установить остаток по объявлению и поставить публикацию в outbox',
  })
  @ApiOkResponse({ type: InventoryViewDto })
  adjust(
    @CurrentTenant() tenantId: string,
    @Body() body: AdjustInventoryDto,
  ): Promise<InventoryViewDto> {
    return this.inventory.adjust(tenantId, body);
  }
}
