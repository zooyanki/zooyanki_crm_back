import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

import { ChannelCode } from '../../generated/prisma/enums.js';
import { CurrentTenant } from '../../tenancy/current-tenant.decorator.js';
import { TENANT_HEADER, TenantGuard } from '../../tenancy/tenant.guard.js';
import { ChannelAccountsService, type ChannelAccountView } from './channel-accounts.service.js';

export class ConnectChannelAccountDto {
  @IsEnum(ChannelCode)
  channel!: ChannelCode;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsString()
  @MinLength(1)
  clientSecret!: string;
}

@ApiTags('Аккаунты площадок')
@ApiHeader({ name: TENANT_HEADER, required: true })
@UseGuards(TenantGuard)
@Controller('channel-accounts')
export class ChannelAccountsController {
  constructor(private readonly accounts: ChannelAccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Подключить аккаунт площадки и сразу проверить ключи' })
  connect(
    @CurrentTenant() tenantId: string,
    @Body() dto: ConnectChannelAccountDto,
  ): Promise<ChannelAccountView> {
    return this.accounts.connect(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Список подключённых аккаунтов' })
  list(@CurrentTenant() tenantId: string): Promise<ChannelAccountView[]> {
    return this.accounts.list(tenantId);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Перепроверить подключение' })
  verify(
    @CurrentTenant() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ChannelAccountView> {
    return this.accounts.verify(tenantId, id);
  }
}
