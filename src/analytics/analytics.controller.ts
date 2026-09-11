import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import { TENANT_HEADER, TenantGuard } from '../tenancy/tenant.guard.js';
import { AnalyticsService, type DailyTotals } from './analytics.service.js';

const DEFAULT_PERIOD_DAYS = 30;

export class DailyTotalsQueryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

@ApiTags('Аналитика')
@ApiHeader({ name: TENANT_HEADER, required: true })
@UseGuards(TenantGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Показы, контакты и расходы по дням' })
  daily(
    @CurrentTenant() tenantId: string,
    @Query() query: DailyTotalsQueryDto,
  ): Promise<DailyTotals[]> {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - DEFAULT_PERIOD_DAYS * 86_400_000);

    return this.analytics.dailyTotals(tenantId, from, to);
  }
}
