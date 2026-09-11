import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

export class DailyTotalsQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class DailyTotalsDto {
  @ApiProperty({ example: '2026-09-11' })
  date!: string;

  @ApiProperty()
  views!: number;

  @ApiProperty()
  contacts!: number;

  @ApiProperty()
  favorites!: number;

  @ApiProperty()
  spending!: number;
}
