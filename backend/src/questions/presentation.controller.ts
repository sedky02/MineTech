import { Controller, Get } from '@nestjs/common';
import { QuestionsService } from './questions.service.js';

/** Public and read-only: only ever exposes the question already on screen. */
@Controller('presentation')
export class PresentationController {
  constructor(private readonly questions: QuestionsService) {}

  @Get('current')
  current() {
    return this.questions.currentlyDisplayed();
  }
}
