import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentTenant } from '../../tenancy/current-tenant.decorator.js';
import { TENANT_HEADER, TenantGuard } from '../../tenancy/tenant.guard.js';
import { ChannelAccountsService } from './channel-accounts.service.js';
import { ChannelAccountViewDto, ConnectChannelAccountDto } from './channel-accounts.dto.js';

@ApiTags('Аккаунты площадок')
@ApiHeader({ name: TENANT_HEADER, required: true })
@UseGuards(TenantGuard)
@Controller('channel-accounts')
export class ChannelAccountsController {
  constructor(private readonly accounts: ChannelAccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Подключить аккаунт площадки и сразу проверить ключи' })
  @ApiOkResponse({ type: ChannelAccountViewDto })
  connect(
    @CurrentTenant() tenantId: string,
    @Body() dto: ConnectChannelAccountDto,
  ): Promise<ChannelAccountViewDto> {
    return this.accounts.connect(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Список подключённых аккаунтов' })
  @ApiOkResponse({ type: [ChannelAccountViewDto] })
  list(@CurrentTenant() tenantId: string): Promise<ChannelAccountViewDto[]> {
    return this.accounts.list(tenantId);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Перепроверить подключение' })
  @ApiOkResponse({ type: ChannelAccountViewDto })
  verify(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ChannelAccountViewDto> {
    return this.accounts.verify(tenantId, id);
  }
}
