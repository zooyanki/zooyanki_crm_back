import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { AppConfigService } from '../core/config/app-config.service.js';
import { PrismaService } from '../core/db/prisma.service.js';
import type { JwtPayload, RequestUser } from './auth.types.js';

export interface RequestWithAuth extends Request {
  user?: RequestUser;
  tenantId?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = extractBearer(request);

    if (!token) {
      throw new UnauthorizedException('Требуется авторизация');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Сессия истекла или токен недействителен');
    }

    // Проверяем, что членство всё ещё существует: отозванный доступ
    // не должен переживать до истечения токена.
    const membership = await this.prisma.withTenant(payload.tenantId, (tx) =>
      tx.membership.findUnique({
        where: {
          tenantId_userId: { tenantId: payload.tenantId, userId: payload.sub },
        },
        select: { role: true },
      }),
    );

    if (!membership) {
      throw new UnauthorizedException('Доступ к арендатору отозван');
    }

    request.user = {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: membership.role,
      email: payload.email,
    };
    request.tenantId = payload.tenantId;

    return true;
  }
}

function extractBearer(request: Request): string | null {
  const header = request.header('authorization');
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}
