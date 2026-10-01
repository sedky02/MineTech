import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EventModule } from '../event/event.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { HostController } from './host.controller.js';
import { ModeratorController } from './moderator.controller.js';
import { PresentationController } from './presentation.controller.js';
import { QuestionsController } from './questions.controller.js';
import { QuestionsService } from './questions.service.js';

@Module({
  imports: [AuthModule, EventModule, RealtimeModule],
  controllers: [
    QuestionsController,
    ModeratorController,
    HostController,
    PresentationController,
  ],
  providers: [QuestionsService],
})
export class QuestionsModule {}
