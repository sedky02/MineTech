import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthUser, AuthenticatedRequest } from '../../auth/auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
