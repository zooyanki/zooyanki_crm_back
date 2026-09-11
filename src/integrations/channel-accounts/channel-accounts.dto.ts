import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

import { ChannelAccountStatus, ChannelCode } from '../../generated/prisma/enums.js';

export class ConnectChannelAccountDto {
  @ApiProperty({ enum: ChannelCode })
  @IsEnum(ChannelCode)
  channel!: ChannelCode;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  clientId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  clientSecret!: string;
}

export class ChannelAccountViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ChannelCode })
  channel!: ChannelCode;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: ChannelAccountStatus })
  status!: ChannelAccountStatus;

  @ApiProperty({ nullable: true, type: String })
  externalUserId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  lastError!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastSyncAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}
