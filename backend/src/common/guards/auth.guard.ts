import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service.js';
import type { AuthenticatedRequest } from '../../auth/auth.types.js';
import type { Role } from '../../generated/prisma/enums.js';
import { AUTH_COOKIE, ROLES_KEY } from '../constants.js';

/**
 * Authenticates the request (cookie, or Bearer header as a fallback) and
 * enforces the roles declared with @Auth(...). The token transport is still
 * an open decision (SPEC open questions), so it is isolated here.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(request);
    const user = token ? await this.auth.verifyToken(token) : null;
    if (!user) throw new UnauthorizedException();

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException();
    }

    request.user = user;
    return true;
  }
}

export function extractToken(request: Request): string | undefined {
  const cookie = (request.cookies as Record<string, string> | undefined)?.[
    AUTH_COOKIE
  ];
  if (cookie) return cookie;
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}
