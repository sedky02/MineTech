import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  AUTH_COOKIE,
  AUTH_TTL_SECONDS,
  LOGIN_IP_LIMIT,
} from '../common/constants.js';
import { Auth } from '../common/decorators/auth.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { baseCookieOptions } from '../common/utils/cookies.js';
import { AuthService } from './auth.service.js';
import type { AuthUser } from './auth.types.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.isProduction = config.get('NODE_ENV') === 'production';
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: LOGIN_IP_LIMIT })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: AuthUser }> {
    const user = await this.auth.validateCredentials(
      dto.username,
      dto.password,
    );
    if (!user) throw new UnauthorizedException('Invalid username or password');

    res.cookie(AUTH_COOKIE, await this.auth.signToken(user), {
      ...baseCookieOptions(this.isProduction),
      maxAge: AUTH_TTL_SECONDS * 1000,
    });
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(AUTH_COOKIE, baseCookieOptions(this.isProduction));
  }

  @Get('me')
  @Auth()
  me(@CurrentUser() user: AuthUser): { user: AuthUser } {
    return { user };
  }
}
