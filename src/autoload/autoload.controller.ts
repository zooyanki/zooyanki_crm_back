import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import {
  AutoloadAccountQueryDto,
  AutoloadItemDto,
  AutoloadRunDto,
  AutoloadSettingsDto,
  CreateFeedListingDto,
  FeedListingDto,
  UpdateAutoloadSettingsDto,
} from './autoload.dto.js';
import { AutoloadService } from './autoload.service.js';

@ApiTags('Автозагрузка')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('autoload')
export class AutoloadController {
  constructor(private readonly autoload: AutoloadService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Настройки XML-фида и публичный URL' })
  @ApiOkResponse({ type: AutoloadSettingsDto })
  settings(
    @CurrentTenant() tenantId: string,
    @Query() query: AutoloadAccountQueryDto,
  ): Promise<AutoloadSettingsDto> {
    return this.autoload.getOrCreateSettings(tenantId, query.channelAccountId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Обновить поля фида по умолчанию' })
  @ApiOkResponse({ type: AutoloadSettingsDto })
  updateSettings(
    @CurrentTenant() tenantId: string,
    @Query() query: AutoloadAccountQueryDto,
    @Body() body: UpdateAutoloadSettingsDto,
  ): Promise<AutoloadSettingsDto> {
    return this.autoload.updateSettings(tenantId, query.channelAccountId, body);
  }

  @Get('listings')
  @ApiOperation({ summary: 'Черновики объявлений для XML-фида' })
  @ApiOkResponse({ type: [FeedListingDto] })
  listListings(
    @CurrentTenant() tenantId: string,
    @Query() query: AutoloadAccountQueryDto,
  ): Promise<FeedListingDto[]> {
    return this.autoload.listFeedListings(tenantId, query.channelAccountId);
  }

  @Post('listings')
  @ApiOperation({ summary: 'Добавить объявление в XML-фид (каталог + черновик)' })
  @ApiOkResponse({ type: FeedListingDto })
  createListing(
    @CurrentTenant() tenantId: string,
    @Body() body: CreateFeedListingDto,
  ): Promise<FeedListingDto> {
    return this.autoload.createFeedListing(tenantId, body);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Запустить выгрузку фида на Авито' })
  @ApiOkResponse({ type: AutoloadRunDto })
  upload(
    @CurrentTenant() tenantId: string,
    @Body() body: AutoloadAccountQueryDto,
  ): Promise<AutoloadRunDto> {
    return this.autoload.triggerUpload(tenantId, body.channelAccountId);
  }

  @Post('reports/refresh')
  @ApiOperation({ summary: 'Подтянуть последний завершённый отчёт' })
  @ApiOkResponse({ type: AutoloadRunDto })
  refresh(
    @CurrentTenant() tenantId: string,
    @Body() body: AutoloadAccountQueryDto,
  ): Promise<AutoloadRunDto> {
    return this.autoload.refreshLastReport(tenantId, body.channelAccountId);
  }

  @Get('runs')
  @ApiOperation({ summary: 'История выгрузок' })
  @ApiOkResponse({ type: [AutoloadRunDto] })
  runs(
    @CurrentTenant() tenantId: string,
    @Query() query: AutoloadAccountQueryDto,
  ): Promise<AutoloadRunDto[]> {
    return this.autoload.listRuns(tenantId, query.channelAccountId);
  }

  @Get('runs/:id/items')
  @ApiOperation({ summary: 'Результаты по позициям выгрузки' })
  @ApiOkResponse({ type: [AutoloadItemDto] })
  items(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AutoloadItemDto[]> {
    return this.autoload.listRunItems(tenantId, id);
  }
}

