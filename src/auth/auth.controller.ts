import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  AuthResponseDto,
  LoginDto,
  MeResponseDto,
  RegisterDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { RequestUser } from './auth.types.js';

@ApiTags('Авторизация')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Регистрация владельца',
    description:
      'Создаёт пользователя и арендатора, либо подключает владельца к пустому арендатору через claimTenantId.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.auth.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Вход' })
  @ApiOkResponse({ type: AuthResponseDto })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Текущий пользователь и арендатор' })
  @ApiOkResponse({ type: MeResponseDto })
  me(@CurrentUser() user: RequestUser): Promise<MeResponseDto> {
    return this.auth.me(user.userId, user.tenantId);
  }
}
