import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Auth } from '../common/decorators/auth.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { EventService } from '../event/event.service.js';
import { ReorderQuestionsDto } from './dto/reorder-questions.dto.js';
import { QuestionsService } from './questions.service.js';

@Controller('moderator')
@Auth(Role.MODERATOR)
@SkipThrottle()
export class ModeratorController {
  constructor(
    private readonly questions: QuestionsService,
    private readonly event: EventService,
  ) {}

  /** Everything the dashboard needs in one call (also used to resync after reconnect). */
  @Get('questions')
  dashboard() {
    return this.questions.moderatorDashboard();
  }

  /** Drag-and-drop priority within one list (pending, waiting for host, ready). */
  @Patch('questions/reorder')
  reorder(@Body() dto: ReorderQuestionsDto) {
    return this.questions.reorder(dto.ids);
  }

  @Patch('questions/:id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.moderatorApprove(id);
  }

  @Patch('questions/:id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.moderatorReject(id);
  }

  @Patch('questions/:id/display')
  display(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.display(id);
  }

  @Patch('questions/:id/remove')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.remove(id);
  }

  @Patch('questions/:id/rollback')
  rollback(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.rollback(id);
  }

  @Patch('questions/:id/answer')
  answer(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.answer(id);
  }

  /** Waiting for host, ready, rejected or answered question → "To review". */
  @Patch('questions/:id/review')
  returnToReview(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.returnToReview(id);
  }

  @Get('event/status')
  status() {
    return this.event.getStatus();
  }

  @Patch('event/pause')
  pause() {
    return this.event.setSubmissionsOpen(false);
  }

  @Patch('event/resume')
  resume() {
    return this.event.setSubmissionsOpen(true);
  }
}
