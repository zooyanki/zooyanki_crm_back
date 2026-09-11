import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

import { PrismaService } from '../core/db/prisma.service.js';

export const TENANT_HEADER = 'x-tenant-id';

export interface RequestWithTenant extends Request {
  tenantId?: string;
}

/// ВРЕМЕННО: арендатор берётся из заголовка запроса.
/// Это заглушка до появления аутентификации пользователей — сервис
/// с таким guard нельзя выставлять в открытый доступ. Когда появится JWT,
/// tenantId будет браться из токена, а заголовок перестанет учитываться.
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithTenant>();
    const tenantId = request.header(TENANT_HEADER);

    if (!tenantId) {
      throw new UnauthorizedException(`Не передан заголовок ${TENANT_HEADER}`);
    }

    const exists = await this.prisma.withTenant(tenantId, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    );

    if (!exists) {
      throw new UnauthorizedException('Арендатор не найден');
    }

    request.tenantId = tenantId;
    return true;
  }
}
