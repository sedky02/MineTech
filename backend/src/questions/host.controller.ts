import { Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Auth } from '../common/decorators/auth.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { QuestionsService } from './questions.service.js';

@Controller('host')
@Auth(Role.HOST)
@SkipThrottle()
export class HostController {
  constructor(private readonly questions: QuestionsService) {}

  /** The single question currently waiting for the host, or null. */
  @Get('question')
  current() {
    return this.questions.hostCurrent();
  }

  @Patch('questions/:id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.hostApprove(id);
  }

  @Patch('questions/:id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.questions.hostReject(id);
  }
}
