import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { MemberRole } from '../generated/prisma/enums.js';

export class RegisterDto {
  @ApiProperty({ example: 'owner@zooyanki.ru' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Илья' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Название нового арендатора. Не нужно, если claimTenantId задан.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  tenantName?: string;

  @ApiPropertyOptional({
    description:
      'Подключиться к уже существующему арендатору без участников. Нужно, чтобы не потерять данные после появления JWT.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  claimTenantId?: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;
}

export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: MemberRole })
  role!: MemberRole;
}

export class AuthTenantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Bearer access token' })
  accessToken!: string;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: AuthTenantDto })
  tenant!: AuthTenantDto;
}

export class MeResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ type: AuthTenantDto })
  tenant!: AuthTenantDto;
}
