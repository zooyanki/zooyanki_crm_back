import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsIn, IsUUID } from 'class-validator';

import { ChannelCode } from '../generated/prisma/enums.js';
import type { SyncEntity } from './sync.types.js';

export class TriggerSyncDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  channelAccountId!: string;

  @ApiProperty({ enum: ChannelCode })
  @IsEnum(ChannelCode)
  channel!: ChannelCode;

  @ApiProperty({ enum: ['listings', 'stats', 'orders', 'chats', 'reviews', 'stocks'] })
  @IsIn(['listings', 'stats', 'orders', 'chats', 'reviews', 'stocks'])
  entity!: SyncEntity;
}

export class TriggerSyncResultDto {
  @ApiProperty({ example: true })
  queued!: true;
}
