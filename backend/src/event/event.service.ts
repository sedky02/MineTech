import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { Room, SocketEvent } from '../realtime/realtime.events.js';

const EVENT_STATE_ID = 1;

export interface PublicEventStatus {
  submissionsOpen: boolean;
}

export interface EventStatus extends PublicEventStatus {
  paused: boolean;
  eventStartsAt: string | null;
}

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly config: ConfigService,
  ) {}

  /** The row is created by the initial migration; upsert keeps this self-healing. */
  private getState() {
    return this.prisma.eventState.upsert({
      where: { id: EVENT_STATE_ID },
      create: { id: EVENT_STATE_ID },
      update: {},
    });
  }

  async getStatus(): Promise<EventStatus> {
    const state = await this.getState();
    return {
      submissionsOpen: state.submissionsOpen,
      paused: !state.submissionsOpen,
      eventStartsAt: this.config.get<string>('EVENT_STARTS_AT') ?? null,
    };
  }

  async getPublicStatus(): Promise<PublicEventStatus> {
    const { submissionsOpen } = await this.getStatus();
    return { submissionsOpen };
  }

  async setSubmissionsOpen(open: boolean): Promise<EventStatus> {
    await this.prisma.eventState.upsert({
      where: { id: EVENT_STATE_ID },
      create: { id: EVENT_STATE_ID, submissionsOpen: open },
      update: { submissionsOpen: open },
    });
    this.realtime.emit(
      Room.MODERATOR,
      open ? SocketEvent.SUBMISSIONS_RESUMED : SocketEvent.SUBMISSIONS_PAUSED,
    );
    return this.getStatus();
  }
}
