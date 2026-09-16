import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import {
  AttachListingDto,
  CatalogItemDto,
  CatalogListResultDto,
  CatalogVariantOptionDto,
  CreateCatalogItemDto,
  ListCatalogQueryDto,
} from './catalog.dto.js';
import { CatalogService } from './catalog.service.js';

@ApiTags('Каталог')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Товары без дублей по площадкам, с публикациями' })
  @ApiOkResponse({ type: CatalogListResultDto })
  list(
    @CurrentTenant() tenantId: string,
    @Query() query: ListCatalogQueryDto,
  ): Promise<CatalogListResultDto> {
    return this.catalog.list(tenantId, query);
  }

  @Get('options')
  @ApiOperation({ summary: 'Короткий список товаров для привязки объявления' })
  @ApiOkResponse({ type: [CatalogVariantOptionDto] })
  options(@CurrentTenant() tenantId: string): Promise<CatalogVariantOptionDto[]> {
    return this.catalog.listVariantOptions(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать товар и выложить на выбранные площадки' })
  @ApiOkResponse({ type: CatalogItemDto })
  create(
    @CurrentTenant() tenantId: string,
    @Body() body: CreateCatalogItemDto,
  ): Promise<CatalogItemDto> {
    return this.catalog.create(tenantId, body);
  }

  @Post('attach')
  @ApiOperation({ summary: 'Присвоить объявление площадки существующему товару' })
  @ApiOkResponse({ type: CatalogItemDto })
  attach(
    @CurrentTenant() tenantId: string,
    @Body() body: AttachListingDto,
  ): Promise<CatalogItemDto> {
    return this.catalog.attachListing(tenantId, body.listingId, body.variantId);
  }
}
