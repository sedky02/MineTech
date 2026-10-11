import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type Question } from '../generated/prisma/client.js';
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
import { toModeratorView, toPublicView } from './question.views.js';

type Tx = Prisma.TransactionClient;

/** Lists the moderator can reorder (SPEC §5). */
const REORDERABLE: QuestionStatus[] = [
  QuestionStatus.PENDING,
  QuestionStatus.MODERATOR_APPROVED,
  QuestionStatus.HOST_APPROVED,
];

const listOrder: Prisma.QuestionOrderByWithRelationInput[] = [
  { position: 'asc' },
  { createdAt: 'asc' },
];

interface DisplayChange {
  /** Was on screen and is now answered. */
  answered: Question | null;
  /** Was on screen and went back to where it came from. */
  removed: Question | null;
  /** Now on screen. */
  current: Question;
}

/**
 * Where a question goes when it leaves the screen without being answered:
 * back to the ready list, or to the host's queue if the moderator skipped
 * the host to display it.
 */
function statusBeforeDisplay(question: { hostApprovedAt: Date | null }) {
  return question.hostApprovedAt
    ? QuestionStatus.HOST_APPROVED
    : QuestionStatus.MODERATOR_APPROVED;
}

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
      if (state && !state.submissionsOpen) {
        throw new ForbiddenException('Submissions are paused');
      }

      const now = new Date();
      await this.enforceSessionLimits(tx, participantSessionId, now);

      return tx.question.create({
        data: {
          category: input.category,
          content: input.content,
          displayName: input.displayName ?? null,
          participantSessionId,
          source:
            this.eventStartsAt && now < this.eventStartsAt
              ? QuestionSource.PRE_EVENT
              : QuestionSource.LIVE,
          createdAt: now,
          position: now.getTime(),
        },
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
        position: Date.now(),
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

  /**
   * Puts a question on screen; whatever was displayed is marked answered.
   * Normally the question is HOST_APPROVED, but the moderator may also skip
   * the host and display a question still waiting for host review.
   */
  async display(id: string) {
    const now = new Date();
    const change = await this.changeDisplay(async (tx) => {
      const displayed = await tx.question.findFirst({
        where: { status: QuestionStatus.DISPLAYED },
        select: { id: true },
      });
      const answered =
        displayed && displayed.id !== id
          ? await this.transition(tx, displayed.id, QuestionStatus.DISPLAYED, {
              status: QuestionStatus.ANSWERED,
              answeredAt: now,
            })
          : null;
      const current = await this.transition(
        tx,
        id,
        [QuestionStatus.HOST_APPROVED, QuestionStatus.MODERATOR_APPROVED],
        { status: QuestionStatus.DISPLAYED, displayedAt: now },
      );
      return { answered, removed: null, current };
    });

    this.emitDisplayChange(change);
    if (change.current.hostApprovedAt === null) {
      // Taken from the host's queue: the host view must move on.
      this.realtime.emit(Room.HOST, SocketEvent.QUESTION_DISPLAYED, { id });
    }
    return toModeratorView(change.current);
  }

  /**
   * Shows the previous (most recently answered) question again. Whatever is
   * on screen was interrupted rather than answered, so it goes back to where
   * it came from. Rolling back repeatedly walks back through the history.
   */
  async rollback(id: string) {
    const now = new Date();
    const change = await this.changeDisplay(async (tx) => {
      const latest = await tx.question.findFirst({
        where: { status: QuestionStatus.ANSWERED },
        orderBy: { answeredAt: 'desc' },
        select: { id: true },
      });
      if (latest?.id !== id) {
        const exists = await tx.question.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Question not found');
        throw new ConflictException(
          'Only the previous question can be rolled back',
        );
      }

      const displayed = await tx.question.findFirst({
        where: { status: QuestionStatus.DISPLAYED },
        select: { id: true, hostApprovedAt: true },
      });
      const removed = displayed
        ? await this.transition(tx, displayed.id, QuestionStatus.DISPLAYED, {
            status: statusBeforeDisplay(displayed),
          })
        : null;
      const current = await this.transition(tx, id, QuestionStatus.ANSWERED, {
        status: QuestionStatus.DISPLAYED,
        displayedAt: now,
        answeredAt: null,
      });
      return { answered: null, removed, current };
    });

    this.emitDisplayChange(change);
    return toModeratorView(change.current);
  }

  /** Takes the question off screen and back to where it came from. */
  async remove(id: string) {
    const existing = await this.prisma.question.findUnique({
      where: { id },
      select: { hostApprovedAt: true },
    });
    if (!existing) throw new NotFoundException('Question not found');

    const question = await this.transition(
      this.prisma,
      id,
      QuestionStatus.DISPLAYED,
      { status: statusBeforeDisplay(existing) },
    );
    this.emitRemoved(question);
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

  async moderatorDashboard() {
    const byStatus = (status: QuestionStatus) =>
      this.prisma.question.findMany({
        where: { status },
        orderBy: listOrder,
      });

    const [pending, awaitingHost, ready, displayed, previous, finished] =
      await Promise.all([
        byStatus(QuestionStatus.PENDING),
        byStatus(QuestionStatus.MODERATOR_APPROVED),
        byStatus(QuestionStatus.HOST_APPROVED),
        this.prisma.question.findFirst({
          where: { status: QuestionStatus.DISPLAYED },
        }),
        this.prisma.question.findFirst({
          where: { status: QuestionStatus.ANSWERED },
          orderBy: { answeredAt: 'desc' },
        }),
        this.prisma.question.groupBy({
          by: ['status'],
          where: {
            status: { in: [QuestionStatus.ANSWERED, QuestionStatus.REJECTED] },
          },
          _count: { _all: true },
        }),
      ]);
    const countOf = (status: QuestionStatus) =>
      finished.find((row) => row.status === status)?._count._all ?? 0;

    return {
      pending: pending.map(toModeratorView),
      awaitingHost: awaitingHost.map(toModeratorView),
      ready: ready.map(toModeratorView),
      displayed: displayed ? toModeratorView(displayed) : null,
      previous: previous ? toModeratorView(previous) : null,
      stats: {
        answered: countOf(QuestionStatus.ANSWERED),
        rejected: countOf(QuestionStatus.REJECTED),
      },
    };
  }

  /**
   * Reorders questions within one list. The given questions swap their
   * existing positions, so questions left out (e.g. hidden by a filter) and
   * questions arriving meanwhile keep their place.
   */
  async reorder(ids: string[]) {
    const status = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.question.findMany({
        where: { id: { in: ids } },
        select: { id: true, status: true, position: true },
      });
      if (rows.length !== ids.length) {
        throw new NotFoundException('Some questions no longer exist');
      }
      const statuses = new Set(rows.map((r) => r.status));
      const [listStatus] = statuses;
      if (statuses.size !== 1 || !REORDERABLE.includes(listStatus)) {
        throw new ConflictException(
          'These questions are no longer in the same list. Refresh and try again.',
        );
      }

      const positions = rows.map((r) => r.position).sort((a, b) => a - b);
      for (const [index, id] of ids.entries()) {
        const { count } = await tx.question.updateMany({
          where: { id, status: listStatus },
          data: { position: positions[index] },
        });
        if (count === 0) {
          throw new ConflictException(
            'A question changed state. Refresh and try again.',
          );
        }
      }
      return listStatus;
    });

    this.realtime.emit(Room.MODERATOR, SocketEvent.QUESTION_REORDERED, {
      status,
    });
    if (status === QuestionStatus.MODERATOR_APPROVED) {
      // The question the host should see next may have changed.
      this.realtime.emit(Room.HOST, SocketEvent.QUESTION_REORDERED, {});
    }
    return { status, ids };
  }

  // ----------------------------------------------------------------------- host

  /**
   * The host only ever sees the first question waiting for them: the oldest
   * one, unless the moderator changed the order.
   */
  async hostCurrent() {
    const question = await this.prisma.question.findFirst({
      where: { status: QuestionStatus.MODERATOR_APPROVED },
      orderBy: listOrder,
    });
    return { question: question ? toPublicView(question) : null };
  }

  async hostApprove(id: string) {
    const question = await this.transition(
      this.prisma,
      id,
      QuestionStatus.MODERATOR_APPROVED,
      {
        status: QuestionStatus.HOST_APPROVED,
        hostApprovedAt: new Date(),
        position: Date.now(),
      },
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
    });
    return { question: question ? toPublicView(question) : null };
  }

  // -------------------------------------------------------------------- helpers

  private async transition(
    db: Tx,
    id: string,
    from: QuestionStatus | QuestionStatus[],
    data: Prisma.QuestionUpdateManyMutationInput,
  ): Promise<Question> {
    const expected = Array.isArray(from) ? from : [from];
    const { count } = await db.question.updateMany({
      where: { id, status: { in: expected } },
      data,
    });
    if (count === 0) {
      const existing = await db.question.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!existing) throw new NotFoundException('Question not found');
      throw new ConflictException(
        `Question is ${existing.status}, expected ${expected.join(' or ')}`,
      );
    }
    return db.question.findUniqueOrThrow({
      where: { id },
    });
  }

  /** Runs a change to what is on screen in one transaction. */
  private async changeDisplay(work: (tx: Tx) => Promise<DisplayChange>) {
    try {
      return await this.prisma.$transaction(work);
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
  }

  private emitDisplayChange({ answered, removed, current }: DisplayChange) {
    if (answered) this.emitAnswered(answered);
    if (removed) this.emitRemoved(removed);
    this.realtime.emit(
      Room.PRESENTATION,
      SocketEvent.QUESTION_DISPLAYED,
      toPublicView(current),
    );
    this.realtime.emit(
      Room.MODERATOR,
      SocketEvent.QUESTION_DISPLAYED,
      toModeratorView(current),
    );
  }

  private emitRemoved(question: Question) {
    this.realtime.emit(Room.PRESENTATION, SocketEvent.QUESTION_REMOVED, {
      id: question.id,
    });
    this.realtime.emit(
      Room.MODERATOR,
      SocketEvent.QUESTION_REMOVED,
      toModeratorView(question),
    );
    if (question.status === QuestionStatus.MODERATOR_APPROVED) {
      // It skipped the host on the way up, so it returns to the host's queue.
      this.realtime.emit(
        Room.HOST,
        SocketEvent.QUESTION_READY_FOR_HOST,
        toPublicView(question),
      );
    }
  }

  private emitAnswered(question: Question) {
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
