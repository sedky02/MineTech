import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import type { Role } from '../../generated/prisma/enums.js';
import { ROLES_KEY } from '../constants.js';
import { AuthGuard } from '../guards/auth.guard.js';

/** Requires an authenticated internal user, optionally with one of `roles`. */
export function Auth(...roles: Role[]) {
  return applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(AuthGuard));
}
