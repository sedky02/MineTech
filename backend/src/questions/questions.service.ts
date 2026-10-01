import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { QuestionSource, QuestionStatus } from '../generated/prisma/enums.js';
import {
  SUBMISSION_COOLDOWN_MS,
  SUBMISSION_WINDOW_MAX,
  SUBMISSION_WINDOW_MS,
} from '../common/constants.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { Room, SocketEvent } from '../realtime/realtime.events.js';
import type { CreateQuestionDto } from './dto/create-question.dto.js';
import {
  type QuestionWithCategory,
  toModeratorView,
  toPublicView,
  withCategory,
} from './question.views.js';

type Tx = Prisma.TransactionClient;

/**
 * The only place question statuses change. Every transition is a conditional
 * UPDATE on the expected current status, so double clicks and concurrent
 * actors can never apply a transition twice (SPEC §4).
 */
@Injectable()
export class QuestionsService {
  private readonly eventStartsAt?: Date;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    config: ConfigService,
  ) {
    const startsAt = config.get<string>('EVENT_STARTS_AT');
    this.eventStartsAt = startsAt ? new Date(startsAt) : undefined;
  }

  // ---------------------------------------------------------------- participant

  async create(input: CreateQuestionDto, participantSessionId: string) {
    const question = await this.prisma.$transaction(async (tx) => {
      // Serializes submissions per session so parallel requests can't slip
      // past the rate limits below.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${participantSessionId}))`;

      const state = await tx.eventState.findUnique({ where: { id: 1 } });
      if (state?.endedAt) throw new ForbiddenException('The event has ended');
      if (state && !state.submissionsOpen) {
        throw new ForbiddenException('Submissions are paused');
      }

      const category = await tx.category.findFirst({
        where: { slug: input.category, isActive: true },
      });
      if (!category) throw new BadRequestException('Invalid category');

      const now = new Date();
      await this.enforceSessionLimits(tx, participantSessionId, now);

      return tx.question.create({
        data: {
          categoryId: category.id,
          content: input.content,
          displayName: input.displayName ?? null,
          participantSessionId,
          source:
            this.eventStartsAt && now < this.eventStartsAt
              ? QuestionSource.PRE_EVENT
              : QuestionSource.LIVE,
          createdAt: now,
        },
        include: withCategory,
      });
    });

    this.realtime.emit(
      Room.MODERATOR,
      SocketEvent.QUESTION_CREATED,
      toModeratorView(question),
    );
  }

  private async enforceSessionLimits(tx: Tx, sessionId: string, now: Date) {
    const recent = await tx.question.findMany({
      where: {
        participantSessionId: sessionId,
        createdAt: { gte: new Date(now.getTime() - SUBMISSION_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const sinceLast = recent[0]
      ? now.getTime() - recent[0].createdAt.getTime()
      : Infinity;
    if (sinceLast < SUBMISSION_COOLDOWN_MS) {
      throw tooManySubmissions(SUBMISSION_COOLDOWN_MS - sinceLast);
    }
    if (recent.length >= SUBMISSION_WINDOW_MAX) {
      const oldestCounted =
        recent[SUBMISSION_WINDOW_MAX - 1].createdAt.getTime();
      throw tooManySubmissions(
        oldestCounted + SUBMISSION_WINDOW_MS - now.getTime(),
      );
    }
  }

  // ------------------------------------------------------------------ moderator

  async moderatorApprove(id: string) {
    const question = await this.transition(
      this.prisma,
      id,
      QuestionStatus.PENDING,
      {
        status: QuestionStatus.MODERATOR_APPROVED,
        moderatorApprovedAt: new Date(),
      },
    );
    this.realtime.emit(
      Room.MODERATOR,
      SocketEvent.QUESTION_MODERATOR_APPROVED,
      toModeratorView(question),
    );
    this.realtime.emit(
      Room.HOST,
      SocketEvent.QUESTION_READY_FOR_HOST,
      toPublicView(question),
    );
    return toModeratorView(question);
  }

  async moderatorReject(id: string) {
    const question = await this.transition(
      this.prisma,
      id,
      QuestionStatus.PENDING,
      {
        status: QuestionStatus.REJECTED,
        moderatorRejectedAt: new Date(),
      },
    );
    // Moderator room only: a moderator rejection never reaches the host.
    this.realtime.emit(
      Room.MODERATOR,
      SocketEvent.QUESTION_MODERATOR_REJECTED,
      toModeratorView(question),
    );
    return toModeratorView(question);
  }

  /** Puts a question on screen; whatever was displayed is marked answered. */
  async display(id: string) {
    const now = new Date();
    let result: {
      previous: QuestionWithCategory | null;
      current: QuestionWithCategory;
    };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const displayed = await tx.question.findFirst({
          where: { status: QuestionStatus.DISPLAYED },
          select: { id: true },
        });
        const previous =
          displayed && displayed.id !== id
            ? await this.transition(
                tx,
                displayed.id,
                QuestionStatus.DISPLAYED,
                {
                  status: QuestionStatus.ANSWERED,
                  answeredAt: now,
                },
              )
            : null;
        const current = await this.transition(
          tx,
          id,
          QuestionStatus.HOST_APPROVED,
          {
            status: QuestionStatus.DISPLAYED,
            displayedAt: now,
          },
        );
        return { previous, current };
      });
    } catch (error) {
      // The partial unique index rejected a second DISPLAYED question.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Another question was displayed at the same time. Refresh and try again.',
        );
      }
      throw error;
    }

    if (result.previous) this.emitAnswered(result.previous);
    this.realtime.emit(
      Room.PRESENTATION,
      SocketEvent.QUESTION_DISPLAYED,
      toPublicView(result.current),
    );
    this.realtime.emit(
      Room.MODERATOR,
      SocketEvent.QUESTION_DISPLAYED,
      toModeratorView(result.current),
    );
    return toModeratorView(result.current);
  }

  /** Takes the question off screen and back to the ready list. */
  async remove(id: string) {
    const question = await this.transition(
      this.prisma,
      id,
      QuestionStatus.DISPLAYED,
      {
        status: QuestionStatus.HOST_APPROVED,
      },
    );
    this.realtime.emit(Room.PRESENTATION, SocketEvent.QUESTION_REMOVED, { id });
    this.realtime.emit(
      Room.MODERATOR,
      SocketEvent.QUESTION_REMOVED,
      toModeratorView(question),
    );
    return toModeratorView(question);
  }

  async answer(id: string) {
    const question = await this.transition(
      this.prisma,
      id,
      QuestionStatus.DISPLAYED,
      {
        status: QuestionStatus.ANSWERED,
        answeredAt: new Date(),
      },
    );
    this.emitAnswered(question);
    return toModeratorView(question);
  }

  /** Removes whatever is on screen, if anything (used by End event). */
  async clearDisplay() {
    const displayed = await this.prisma.question.findFirst({
      where: { status: QuestionStatus.DISPLAYED },
      select: { id: true },
    });
    if (!displayed) return;
    try {
      await this.remove(displayed.id);
    } catch (error) {
      // Someone else changed it in the meantime: the screen is already moving on.
      if (!(error instanceof ConflictException)) throw error;
    }
  }

  async moderatorDashboard() {
    const byStatus = (
      status: QuestionStatus,
      orderBy: Prisma.QuestionOrderByWithRelationInput,
    ) =>
      this.prisma.question.findMany({
        where: { status },
        orderBy,
        include: withCategory,
      });

    const [pending, awaitingHost, ready, displayed, previous] =
      await Promise.all([
        byStatus(QuestionStatus.PENDING, { createdAt: 'asc' }),
        byStatus(QuestionStatus.MODERATOR_APPROVED, {
          moderatorApprovedAt: 'asc',
        }),
        byStatus(QuestionStatus.HOST_APPROVED, { hostApprovedAt: 'asc' }),
        this.prisma.question.findFirst({
          where: { status: QuestionStatus.DISPLAYED },
          include: withCategory,
        }),
        this.prisma.question.findFirst({
          where: { status: QuestionStatus.ANSWERED },
          orderBy: { answeredAt: 'desc' },
          include: withCategory,
        }),
      ]);

    return {
      pending: pending.map(toModeratorView),
      awaitingHost: awaitingHost.map(toModeratorView),
      ready: ready.map(toModeratorView),
      displayed: displayed ? toModeratorView(displayed) : null,
      previous: previous ? toModeratorView(previous) : null,
    };
  }

  // ----------------------------------------------------------------------- host

  /** The host only ever sees the oldest question waiting for them. */
  async hostCurrent() {
    const question = await this.prisma.question.findFirst({
      where: { status: QuestionStatus.MODERATOR_APPROVED },
      orderBy: { moderatorApprovedAt: 'asc' },
      include: withCategory,
    });
    return { question: question ? toPublicView(question) : null };
  }

  async hostApprove(id: string) {
    const question = await this.transition(
      this.prisma,
      id,
      QuestionStatus.MODERATOR_APPROVED,
      { status: QuestionStatus.HOST_APPROVED, hostApprovedAt: new Date() },
    );
    this.realtime.emit(
      Room.MODERATOR,
      SocketEvent.QUESTION_HOST_APPROVED,
      toModeratorView(question),
    );
    this.realtime.emit(Room.HOST, SocketEvent.QUESTION_HOST_APPROVED, { id });
    return toPublicView(question);
  }

  async hostReject(id: string) {
    const question = await this.transition(
      this.prisma,
      id,
      QuestionStatus.MODERATOR_APPROVED,
      { status: QuestionStatus.REJECTED, hostRejectedAt: new Date() },
    );
    // Never sent to the presentation room.
    this.realtime.emit(
      Room.MODERATOR,
      SocketEvent.QUESTION_HOST_REJECTED,
      toModeratorView(question),
    );
    this.realtime.emit(Room.HOST, SocketEvent.QUESTION_HOST_REJECTED, { id });
    return toPublicView(question);
  }

  // --------------------------------------------------------------- presentation

  async currentlyDisplayed() {
    const question = await this.prisma.question.findFirst({
      where: { status: QuestionStatus.DISPLAYED },
      include: withCategory,
    });
    return { question: question ? toPublicView(question) : null };
  }

  // -------------------------------------------------------------------- helpers

  private async transition(
    db: Tx,
    id: string,
    from: QuestionStatus,
    data: Prisma.QuestionUpdateManyMutationInput,
  ): Promise<QuestionWithCategory> {
    const { count } = await db.question.updateMany({
      where: { id, status: from },
      data,
    });
    if (count === 0) {
      const existing = await db.question.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!existing) throw new NotFoundException('Question not found');
      throw new ConflictException(
        `Question is ${existing.status}, expected ${from}`,
      );
    }
    return db.question.findUniqueOrThrow({
      where: { id },
      include: withCategory,
    });
  }

  private emitAnswered(question: QuestionWithCategory) {
    this.realtime.emit(Room.PRESENTATION, SocketEvent.QUESTION_ANSWERED, {
      id: question.id,
    });
    this.realtime.emit(
      Room.MODERATOR,
      SocketEvent.QUESTION_ANSWERED,
      toModeratorView(question),
    );
  }
}

function tooManySubmissions(retryAfterMs: number) {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: `Please wait ${retryAfterSeconds}s before asking another question.`,
      retryAfterSeconds,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
