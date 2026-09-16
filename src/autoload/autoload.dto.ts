import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { AutoloadRunStatus, ListingStatus } from '../generated/prisma/enums.js';

export class AutoloadAccountQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  channelAccountId!: string;
}

export class CreateFeedListingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  channelAccountId!: string;

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

  @ApiPropertyOptional({
    description: 'SKU / Id в XML-фиде. Если не задан — сгенерируем',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;
}

export class FeedListingDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  channelAccountId!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  variantId!: string | null;

  @ApiProperty()
  sku!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  price!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty({ nullable: true, type: String })
  avitoAdId!: string | null;

  @ApiProperty({ enum: ListingStatus })
  status!: ListingStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class UpdateAutoloadSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  category?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  goodsType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  address?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  managerName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  condition?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionFallback?: string;
}

export class AutoloadSettingsDto {
  @ApiProperty({ format: 'uuid' })
  channelAccountId!: string;

  @ApiProperty()
  feedUrl!: string;

  @ApiProperty()
  category!: string;

  @ApiProperty({ nullable: true, type: String })
  goodsType!: string | null;

  @ApiProperty()
  address!: string;

  @ApiProperty({ nullable: true, type: String })
  contactPhone!: string | null;

  @ApiProperty({ nullable: true, type: String })
  managerName!: string | null;

  @ApiProperty()
  condition!: string;

  @ApiProperty()
  descriptionFallback!: string;
}

export class AutoloadRunDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  channelAccountId!: string;

  @ApiProperty({ enum: AutoloadRunStatus })
  status!: AutoloadRunStatus;

  @ApiProperty({ nullable: true, type: String })
  externalReportId!: string | null;

  @ApiProperty()
  itemsTotal!: number;

  @ApiProperty()
  itemsOk!: number;

  @ApiProperty()
  itemsError!: number;

  @ApiProperty({ nullable: true, type: String })
  lastError!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt!: Date;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  finishedAt!: Date | null;
}

export class AutoloadItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  adId!: string;

  @ApiProperty({ nullable: true, type: String })
  avitoId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  section!: string | null;

  @ApiProperty({ nullable: true, type: String })
  sectionTitle!: string | null;

  @ApiProperty({ nullable: true, type: String })
  avitoStatus!: string | null;

  @ApiProperty({ nullable: true, type: String })
  url!: string | null;

  @ApiProperty({ nullable: true })
  messagesJson!: unknown;
}
