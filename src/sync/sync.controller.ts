import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import { TENANT_HEADER, TenantGuard } from '../tenancy/tenant.guard.js';
import { TriggerSyncDto, TriggerSyncResultDto } from './sync.dto.js';
import { SyncScheduler } from './sync.scheduler.js';

@ApiTags('Синхронизация')
@ApiHeader({ name: TENANT_HEADER, required: true })
@UseGuards(TenantGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly scheduler: SyncScheduler) {}

  @Post('trigger')
  @ApiOperation({ summary: 'Запустить синхронизацию аккаунта немедленно' })
  @ApiOkResponse({ type: TriggerSyncResultDto })
  async trigger(
    @CurrentTenant() tenantId: string,
    @Body() dto: TriggerSyncDto,
  ): Promise<TriggerSyncResultDto> {
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
