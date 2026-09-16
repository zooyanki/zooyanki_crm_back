import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import { ChannelCode } from '../generated/prisma/enums.js';

export class ListInventoryQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 50;
}

export class AdjustInventoryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  listingId!: string;

  @ApiProperty({ minimum: 0, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Ставить публикацию остатка в outbox для площадки',
  })
  @IsOptional()
  @IsBoolean()
  pushToChannel?: boolean;
}

export class InventoryViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty({ nullable: true, type: String })
  title!: string | null;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  reserved!: number;

  @ApiProperty()
  available!: number;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  listingId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  listingExternalId!: string | null;

  @ApiProperty({ nullable: true, enum: ChannelCode })
  channel!: ChannelCode | null;

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  channelAccountId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class InventoryListResultDto {
  @ApiProperty({ type: [InventoryViewDto] })
  items!: InventoryViewDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}
