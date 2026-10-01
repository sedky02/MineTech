import type { Request } from 'express';
import type { Role } from '../generated/prisma/enums.js';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  role: Role;
}

export type AuthenticatedRequest = Request & { user: AuthUser };
