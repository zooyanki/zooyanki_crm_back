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
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { ChannelCode, ListingStatus } from '../generated/prisma/enums.js';

export class ListCatalogQueryDto {
  @ApiPropertyOptional({ enum: ListingStatus, default: ListingStatus.ACTIVE })
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

export class CatalogPublicationDto {
  @ApiProperty({ format: 'uuid' })
  listingId!: string;

  @ApiProperty({ enum: ChannelCode })
  channel!: ChannelCode;

  @ApiProperty({ format: 'uuid' })
  channelAccountId!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty({ enum: ListingStatus })
  status!: ListingStatus;

  @ApiProperty({ nullable: true, type: String })
  url!: string | null;
}

export class CatalogItemDto {
  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ nullable: true, type: Number })
  price!: number | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ type: [CatalogPublicationDto] })
  publications!: CatalogPublicationDto[];

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class CatalogListResultDto {
  @ApiProperty({ type: [CatalogItemDto] })
  items!: CatalogItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}

export class CreateCatalogItemDto {
  @ApiProperty({ example: 'Фильтр масляный Toyota', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  title!: string;

  @ApiProperty({ maxLength: 7500 })
  @IsString()
  @MinLength(1)
  @MaxLength(7500)
  description!: string;

  @ApiProperty({ example: 1200, minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Аккаунты площадок, на которые выложить объявление',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  channelAccountIds!: string[];
}

export class AttachListingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  listingId!: string;

  @ApiProperty({ format: 'uuid', description: 'Целевой вариант каталога' })
  @IsUUID()
  variantId!: string;
}

export class CatalogVariantOptionDto {
  @ApiProperty({ format: 'uuid' })
  variantId!: string;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  title!: string;
}
