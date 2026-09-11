import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsIn, IsUUID } from 'class-validator';

import { ChannelCode } from '../generated/prisma/enums.js';
import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import { TENANT_HEADER, TenantGuard } from '../tenancy/tenant.guard.js';
import { SyncScheduler } from './sync.scheduler.js';
import type { SyncEntity } from './sync.types.js';

export class TriggerSyncDto {
  @IsUUID()
  channelAccountId!: string;

  @IsEnum(ChannelCode)
  channel!: ChannelCode;

  @IsIn(['listings', 'stats'])
  entity!: SyncEntity;
}

@ApiTags('Синхронизация')
@ApiHeader({ name: TENANT_HEADER, required: true })
@UseGuards(TenantGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly scheduler: SyncScheduler) {}

  @Post('trigger')
  @ApiOperation({ summary: 'Запустить синхронизацию аккаунта немедленно' })
  async trigger(
    @CurrentTenant() tenantId: string,
    @Body() dto: TriggerSyncDto,
  ): Promise<{ queued: true }> {
    await this.scheduler.triggerNow({
      kind: 'account',
      entity: dto.entity,
      tenantId,
      channelAccountId: dto.channelAccountId,
      channel: dto.channel,
    });

    return { queued: true };
  }
}
