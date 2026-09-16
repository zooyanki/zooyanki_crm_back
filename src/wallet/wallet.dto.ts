import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsUUID } from 'class-validator';

export class WalletBalanceQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  channelAccountId!: string;
}

export class WalletOperationsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  channelAccountId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  dateFrom!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Type(() => Date)
  @IsDate()
  dateTo!: Date;
}

export class WalletBalanceDto {
  @ApiProperty({ format: 'uuid' })
  channelAccountId!: string;

  @ApiProperty()
  real!: number;

  @ApiProperty()
  bonus!: number;
}

export class WalletOperationDto {
  @ApiProperty()
  amountBonus!: number;

  @ApiProperty()
  amountRub!: number;

  @ApiProperty()
  amountTotal!: number;

  @ApiProperty({ nullable: true, type: String })
  itemId!: string | null;

  @ApiProperty()
  operationName!: string;

  @ApiProperty()
  operationType!: string;

  @ApiProperty({ nullable: true, type: String })
  serviceName!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  serviceType!: string | null;

  @ApiProperty()
  updatedAt!: string;
}

export class WalletOperationsResultDto {
  @ApiProperty({ format: 'uuid' })
  channelAccountId!: string;

  @ApiProperty()
  from!: string;

  @ApiProperty()
  to!: string;

  @ApiProperty({ type: [WalletOperationDto] })
  items!: WalletOperationDto[];
}

