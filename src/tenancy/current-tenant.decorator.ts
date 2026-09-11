import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

import type { RequestWithTenant } from './tenant.guard.js';

/// Идентификатор арендатора из текущего запроса. Доступен только там,
/// где применён TenantGuard.
export const CurrentTenant = createParamDecorator((_: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<RequestWithTenant>();

  if (!request.tenantId) {
    throw new InternalServerErrorException('TenantGuard не применён к этому обработчику');
  }

  return request.tenantId;
});
