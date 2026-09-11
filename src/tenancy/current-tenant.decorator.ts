import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

import type { RequestWithAuth } from '../auth/jwt-auth.guard.js';

/// Идентификатор арендатора из JWT. Доступен только там, где применён JwtAuthGuard.
export const CurrentTenant = createParamDecorator((_: unknown, context: ExecutionContext): string => {
  const request = context.switchToHttp().getRequest<RequestWithAuth>();

  if (!request.tenantId) {
    throw new InternalServerErrorException('JwtAuthGuard не применён к этому обработчику');
  }

  return request.tenantId;
});
