import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

import { ChannelCode } from '../generated/prisma/enums.js';

export class ListReviewsQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 20;
}

export class ReviewViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ChannelCode })
  channel!: ChannelCode;

  @ApiProperty({ format: 'uuid' })
  channelAccountId!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty({ nullable: true, type: String })
  text!: string | null;

  @ApiProperty({ nullable: true, type: String })
  stage!: string | null;

  @ApiProperty()
  canAnswer!: boolean;

  @ApiProperty({ nullable: true, type: String })
  itemExternalId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  itemTitle!: string | null;

  @ApiProperty({ nullable: true, type: String })
  authorName!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  publishedAt!: Date | null;

  @ApiProperty({ nullable: true, type: String })
  answerExternalId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  answerText!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  syncedAt!: Date | null;
}

export class ReviewListResultDto {
  @ApiProperty({ type: [ReviewViewDto] })
  items!: ReviewViewDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}

export class AnswerReviewDto {
  @ApiProperty({ example: 'Спасибо за отзыв!' })
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  text!: string;
}

