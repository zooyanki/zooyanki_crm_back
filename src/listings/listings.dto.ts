import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

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

export class UpdateListingPriceDto {
  @ApiProperty({ example: 1500 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;
}

export class QueuedListingActionDto {
  @ApiProperty({ example: true })
  queued!: true;

  @ApiProperty({ format: 'uuid' })
  listingId!: string;
}

export class VasPriceItemDto {
  @ApiProperty({ example: 'xl' })
  slug!: string;

  @ApiProperty()
  price!: number;

  @ApiPropertyOptional()
  priceOld?: number;
}

export class VasStickerDto {
  @ApiProperty()
  id!: number;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  description?: string;
}

export class VasOfferDto {
  @ApiProperty()
  externalId!: string;

  @ApiProperty({ type: [VasPriceItemDto] })
  vas!: VasPriceItemDto[];

  @ApiProperty({ type: [VasStickerDto] })
  stickers!: VasStickerDto[];
}

export class ApplyVasDto {
  @ApiProperty({ type: [String], example: ['xl', 'highlight'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  slugs!: string[];

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  stickers?: number[];
}
