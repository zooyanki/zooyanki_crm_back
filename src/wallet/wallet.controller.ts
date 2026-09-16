import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentTenant } from '../tenancy/current-tenant.decorator.js';
import {
  WalletBalanceDto,
  WalletBalanceQueryDto,
  WalletOperationsQueryDto,
  WalletOperationsResultDto,
} from './wallet.dto.js';
import { WalletService } from './wallet.service.js';

@ApiTags('Кошелёк')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Баланс кошелька площадки' })
  @ApiOkResponse({ type: WalletBalanceDto })
  balance(
    @CurrentTenant() tenantId: string,
    @Query() query: WalletBalanceQueryDto,
  ): Promise<WalletBalanceDto> {
    return this.wallet.balance(tenantId, query.channelAccountId);
  }

  @Get('operations')
  @ApiOperation({ summary: 'История операций кошелька (не более 7 дней)' })
  @ApiOkResponse({ type: WalletOperationsResultDto })
  operations(
    @CurrentTenant() tenantId: string,
    @Query() query: WalletOperationsQueryDto,
  ): Promise<WalletOperationsResultDto> {
    return this.wallet.operations(
      tenantId,
      query.channelAccountId,
      query.dateFrom,
      query.dateTo,
    );
  }
}

