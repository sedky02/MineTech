import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { Room, SocketEvent } from '../realtime/realtime.events.js';

const EVENT_STATE_ID = 1;

export interface PublicEventStatus {
  submissionsOpen: boolean;
  ended: boolean;
}

export interface EventStatus extends PublicEventStatus {
  paused: boolean;
  endedAt: Date | null;
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
    const ended = state.endedAt !== null;
    return {
      submissionsOpen: state.submissionsOpen && !ended,
      paused: !state.submissionsOpen && !ended,
      ended,
      endedAt: state.endedAt,
      eventStartsAt: this.config.get<string>('EVENT_STARTS_AT') ?? null,
    };
  }

  async getPublicStatus(): Promise<PublicEventStatus> {
    const { submissionsOpen, ended } = await this.getStatus();
    return { submissionsOpen, ended };
  }

  async setSubmissionsOpen(open: boolean): Promise<EventStatus> {
    const state = await this.getState();
    if (state.endedAt) throw new ConflictException('The event has ended');

    await this.prisma.eventState.update({
      where: { id: EVENT_STATE_ID },
      data: { submissionsOpen: open },
    });
    this.realtime.emit(
      Room.MODERATOR,
      open ? SocketEvent.SUBMISSIONS_RESUMED : SocketEvent.SUBMISSIONS_PAUSED,
    );
    return this.getStatus();
  }

  /** Closes submissions for good. Idempotent: keeps the first end time. */
  async markEnded(): Promise<void> {
    await this.prisma.eventState.updateMany({
      where: { id: EVENT_STATE_ID, endedAt: null },
      data: { submissionsOpen: false, endedAt: new Date() },
    });
  }
}
