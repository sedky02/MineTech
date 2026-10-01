import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { parseCorsOrigins } from './config/env.validation.js';
import { CorsIoAdapter } from './realtime/cors-io.adapter.js';

/**
 * Shared by main.ts and the e2e tests. The app must be created with
 * `bodyParser: false` so the size limit below is the only JSON parser.
 */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  const origins = parseCorsOrigins(config.getOrThrow<string>('CORS_ORIGIN'));

  if (config.get('NODE_ENV') === 'production') {
    // Render terminates TLS in front of the app; trust its X-Forwarded-For
    // so rate limiting sees the real client IP.
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '10kb' });
  app.enableCors({ origin: origins, credentials: true });
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
}
