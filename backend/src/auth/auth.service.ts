import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { UsersService } from '../users/users.service.js';
import type { AuthUser, JwtPayload } from './auth.types.js';

@Injectable()
export class AuthService {
  /** Verified against when the username is unknown, so both paths cost the same. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async validateCredentials(
    username: string,
    password: string,
  ): Promise<AuthUser | null> {
    const user = await this.users.findByUsername(username);
    if (!user) {
      this.dummyHash ??= argon2.hash('minetech-timing-equalizer');
      await argon2.verify(await this.dummyHash, password);
      return null;
    }
    const valid = await argon2.verify(user.passwordHash, password);
    return valid
      ? { id: user.id, username: user.username, role: user.role }
      : null;
  }

  signToken(user: AuthUser): Promise<string> {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    return this.jwt.signAsync(payload);
  }

  /**
   * Returns the user behind a token, or null. The role is read from the
   * database, so deleting a user or changing their role takes effect at once.
   */
  async verifyToken(token: string): Promise<AuthUser | null> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      return null;
    }
    const user = await this.users.findById(payload.sub);
    return user
      ? { id: user.id, username: user.username, role: user.role }
      : null;
  }
}
