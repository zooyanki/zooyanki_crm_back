import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';



import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';

import {

  ApplyVasDto,

  ListingListResultDto,

  ListListingsQueryDto,

  QueuedListingActionDto,

  UpdateListingPriceDto,

  VasOfferDto,

} from './listings.dto.js';

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



  @Post(':id/price')

  @ApiOperation({ summary: 'Поставить смену цены в outbox' })

  @ApiOkResponse({ type: QueuedListingActionDto })

  updatePrice(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() body: UpdateListingPriceDto,

  ): Promise<QueuedListingActionDto> {

    return this.listings.queuePriceUpdate(tenantId, id, body.price);

  }



  @Get(':id/vas')

  @ApiOperation({ summary: 'Доступные услуги продвижения для объявления' })

  @ApiOkResponse({ type: VasOfferDto })

  vasPrices(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

  ): Promise<VasOfferDto> {

    return this.listings.vasPrices(tenantId, id);

  }



  @Post(':id/vas')

  @ApiOperation({ summary: 'Поставить применение услуг продвижения в outbox' })

  @ApiOkResponse({ type: QueuedListingActionDto })

  applyVas(

    @CurrentTenant() tenantId: string,

    @Param('id', ParseUUIDPipe) id: string,

    @Body() body: ApplyVasDto,

  ): Promise<QueuedListingActionDto> {

    return this.listings.queueVasApply(tenantId, id, body.slugs, body.stickers);

  }

}


