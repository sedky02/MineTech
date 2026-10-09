import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { ModeratorCategoriesController } from './moderator-categories.controller.js';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [CategoriesController, ModeratorCategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
