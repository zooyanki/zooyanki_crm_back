import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import { AnalyticsService } from './analytics.service.js';
import { DailyTotalsDto, DailyTotalsQueryDto } from './analytics.dto.js';

const DEFAULT_PERIOD_DAYS = 30;

@ApiTags('Аналитика')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Показы, контакты и расходы по дням' })
  @ApiOkResponse({ type: [DailyTotalsDto] })
  daily(
    @CurrentTenant() tenantId: string,
    @Query() query: DailyTotalsQueryDto,
  ): Promise<DailyTotalsDto[]> {
    const to = query.to ?? new Date();
    const from = query.from ?? new Date(to.getTime() - DEFAULT_PERIOD_DAYS * 86_400_000);

    return this.analytics.dailyTotals(tenantId, from, to);
  }
}
