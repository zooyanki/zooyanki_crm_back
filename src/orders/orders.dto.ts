import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { ChannelCode, OrderStatus } from '../generated/prisma/enums.js';

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

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

export class OrderActionViewDto {
  @ApiProperty({
    example: 'confirm',
    description: 'Имя действия площадки: confirm, reject, perform, receive, setTrackNumber…',
  })
  name!: string;

  @ApiProperty()
  required!: boolean;
}

export class OrderItemViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty()
  price!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ nullable: true, type: String })
  avitoId!: string | null;
}

export class OrderViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ChannelCode })
  channel!: ChannelCode;

  @ApiProperty({ format: 'uuid' })
  channelAccountId!: string;

  @ApiProperty()
  externalId!: string;

  @ApiProperty({ nullable: true, type: String })
  marketplaceId!: string | null;

  @ApiProperty({ enum: OrderStatus })
  status!: OrderStatus;

  @ApiProperty()
  rawStatus!: string;

  @ApiProperty({ type: [OrderActionViewDto] })
  availableActions!: OrderActionViewDto[];

  @ApiProperty({ nullable: true, type: Number })
  totalAmount!: number | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  placedAt!: Date;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  syncedAt!: Date | null;

  @ApiProperty({ type: [OrderItemViewDto] })
  items!: OrderItemViewDto[];
}

export class OrderListResultDto {
  @ApiProperty({ type: [OrderViewDto] })
  items!: OrderViewDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  perPage!: number;
}

export class ApplyOrderTransitionDto {
  @ApiProperty({
    enum: ['confirm', 'reject', 'perform', 'receive'],
    example: 'confirm',
  })
  @IsIn(['confirm', 'reject', 'perform', 'receive'])
  transition!: 'confirm' | 'reject' | 'perform' | 'receive';

  @ApiPropertyOptional({
    description: 'Код подтверждения для CNC (самовывоз)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  confirmCode?: string;
}

export class SetOrderTrackingDto {
  @ApiProperty({ example: '01-01031002199' })
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  trackingNumber!: string;
}

export class QueuedOrderActionDto {
  @ApiProperty({ example: true })
  queued!: true;

  @ApiProperty({ format: 'uuid' })
  orderId!: string;
}

export class AcceptOrderReturnDto {
  @ApiProperty({ example: '123456', description: 'Номер отделения Почты России' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  terminalNumber!: string;

  @ApiProperty({ example: 'Иванов Иван Иванович' })
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  recipientName!: string;

  @ApiProperty({ example: '+79001234567' })
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  recipientPhone!: string;
}

export class OrderLabelsResultDto {
  @ApiProperty({ example: 'label-12345.pdf' })
  filename!: string;

  @ApiProperty({ example: 'application/pdf' })
  contentType!: string;

  @ApiProperty({ description: 'PDF в base64' })
  data!: string;
}

export class OrderMarkingItemDto {
  @ApiProperty({ description: 'ID товара в Авито (avitoId позиции)' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  itemId!: string;

  @ApiProperty({ type: [String], example: ['36376376113637637611363763761123'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  markings!: string[];
}

export class SetOrderMarkingsDto {
  @ApiProperty({ type: [OrderMarkingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderMarkingItemDto)
  items!: OrderMarkingItemDto[];
}

export class CourierTimeIntervalDto {
  @ApiProperty()
  startDate!: string;

  @ApiProperty()
  endDate!: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  type?: string;
}

export class CourierDateOptionDto {
  @ApiProperty()
  date!: string;

  @ApiProperty({ type: [CourierTimeIntervalDto] })
  timeIntervals!: CourierTimeIntervalDto[];
}

export class CourierRangeResultDto {
  @ApiPropertyOptional()
  address?: string;

  @ApiPropertyOptional()
  addressDetails?: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiProperty({ type: [CourierDateOptionDto] })
  dateOptions!: CourierDateOptionDto[];
}

export class GetCourierRangeQueryDto {
  @ApiPropertyOptional({ description: 'Адрес продавца (необязательно)' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  address?: string;
}

export class SetCourierRangeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  addressDetails?: string;

  @ApiProperty({ format: 'date-time' })
  @IsString()
  @MinLength(1)
  startDate!: string;

  @ApiProperty({ format: 'date-time' })
  @IsString()
  @MinLength(1)
  endDate!: string;

  @ApiProperty({ enum: ['fixed', 'asap'] })
  @IsIn(['fixed', 'asap'])
  intervalType!: 'fixed' | 'asap';

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  phone!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(128)
  name!: string;
}

export class SetCncDetailsDto {
  @ApiProperty({ example: 4, description: 'Срок бронирования в днях' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  bookingPeriod!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  address?: string;

  @ApiPropertyOptional({ description: 'Комментарий покупателю' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  details?: string;
}
