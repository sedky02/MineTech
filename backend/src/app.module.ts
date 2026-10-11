import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { DEFAULT_IP_LIMIT } from './common/constants.js';
import { validateEnv } from './config/env.validation.js';
import { EventModule } from './event/event.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QuestionsModule } from './questions/questions.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // IP-based limits. In-memory storage is fine: this is abuse protection,
    // not application state, and there is a single backend instance.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ...DEFAULT_IP_LIMIT }],
    }),
    PrismaModule,
    AuthModule,
    RealtimeModule,
    EventModule,
    QuestionsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
