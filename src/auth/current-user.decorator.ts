import {
  createParamDecorator,
  type ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';

import type { RequestWithAuth } from './jwt-auth.guard.js';
import type { RequestUser } from './auth.types.js';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): RequestUser => {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();

    if (!request.user) {
      throw new InternalServerErrorException('JwtAuthGuard не применён к этому обработчику');
    }

    return request.user;
  },
);
