import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  configureApp(app);

  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  // 0.0.0.0 is required on Render.
  await app.listen(port, '0.0.0.0');
  Logger.log(`MineTech API listening on port ${port}`, 'Bootstrap');
}
await bootstrap();
