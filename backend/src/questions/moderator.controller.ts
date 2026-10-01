import { Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Auth } from '../common/decorators/auth.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { EventService } from '../event/event.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { Room, SocketEvent } from '../realtime/realtime.events.js';
import { QuestionsService } from './questions.service.js';

@Controller('moderator')
@Auth(Role.MODERATOR)
@SkipThrottle()
export class ModeratorController {
  constructor(
    private readonly questions: QuestionsService,
    private readonly event: EventService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Everything the dashboard needs in one call (also used to resync after reconnect). */
  @Get('questions')
  dashboard() {
    return this.questions.moderatorDashboard();
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

  @Patch('questions/:id/answer')
  answer(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.answer(id);
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

  /** Closes submissions for good and returns the presentation to the idle screen. */
  @Patch('event/end')
  async end() {
    await this.event.markEnded();
    await this.questions.clearDisplay();
    this.realtime.emit(
      [Room.MODERATOR, Room.HOST, Room.PRESENTATION],
      SocketEvent.EVENT_ENDED,
    );
    return this.event.getStatus();
  }
}
