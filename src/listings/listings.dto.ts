import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { ChannelCode, ListingStatus } from '../generated/prisma/enums.js';

export class ListListingsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  channelAccountId?: string;

  @ApiPropertyOptional({ enum: ListingStatus })
  @IsOptional()
  @IsEnum(ListingStatus)
  status?: ListingStatus;

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

export class ListingViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ChannelCode })
  channel!: ChannelCode;

  @ApiProperty({ format: 'uuid' })
  channelAccountId!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty({ nullable: true, type: String })
  title!: string | null;

  @ApiProperty({ nullable: true, type: String })
  url!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  price!: number | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ enum: ListingStatus })
  status!: ListingStatus;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  publishedAt!: Date | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  syncedAt!: Date | null;
}

export class ListingListResultDto {
  @ApiProperty({ type: [ListingViewDto] })
  items!: ListingViewDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}
