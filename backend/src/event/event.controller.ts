import { Controller, Get } from '@nestjs/common';
import { EventService } from './event.service.js';

@Controller('event')
export class EventController {
  constructor(private readonly event: EventService) {}

  @Get('status')
  status() {
    return this.event.getPublicStatus();
  }
}
