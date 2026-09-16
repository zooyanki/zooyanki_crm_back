import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

import { ChannelCode, MessageDirection, MessageType } from '../generated/prisma/enums.js';

export class ListConversationsQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage = 30;
}

export class ListMessagesQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  perPage = 100;
}

export class ConversationViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ChannelCode })
  channel!: ChannelCode;

  @ApiProperty({ format: 'uuid' })
  channelAccountId!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty({ nullable: true, type: String })
  listingExternalId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  listingTitle!: string | null;

  @ApiProperty({ nullable: true, type: String })
  peerExternalId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  peerName!: string | null;

  @ApiProperty()
  unreadCount!: number;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastMessageAt!: Date | null;

  @ApiProperty({ nullable: true, type: String })
  lastMessagePreview!: string | null;

  @ApiProperty({ nullable: true, enum: MessageDirection })
  lastMessageDirection!: MessageDirection | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  syncedAt!: Date | null;
}

export class ConversationListResultDto {
  @ApiProperty({ type: [ConversationViewDto] })
  items!: ConversationViewDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}

export class MessageViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  conversationId!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty({ enum: MessageDirection })
  direction!: MessageDirection;

  @ApiProperty({ enum: MessageType })
  type!: MessageType;

  @ApiProperty({ nullable: true, type: String })
  bodyText!: string | null;

  @ApiProperty({ nullable: true })
  contentJson!: unknown;

  @ApiProperty({ nullable: true, type: String })
  authorExternalId!: string | null;

  @ApiProperty()
  isRead!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  sentAt!: Date;
}

export class MessageListResultDto {
  @ApiProperty({ type: [MessageViewDto] })
  items!: MessageViewDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}

export class SendTextMessageDto {
  @ApiProperty({ example: 'Здравствуйте! Товар ещё актуален?' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}

export class SubscribeWebhookDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  channelAccountId!: string;
}

export class WebhookSubscribeResultDto {
  @ApiProperty()
  url!: string;
}

