import type { Socket } from 'socket.io-client';
import {
  HOST,
  MODERATOR,
  type TestContext,
  connectSocket,
  createTestApp,
  login,
  recordEvents,
  resetDatabase,
  settle,
  submit,
} from './helpers.js';

describe('Question workflow (SPEC §4, §20)', () => {
  let ctx: TestContext;
  let modCookie: string;
  let hostCookie: string;
  let sockets: Socket[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    modCookie = await login(ctx, MODERATOR);
    hostCookie = await login(ctx, HOST);
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  afterEach(() => {
    sockets.forEach((s) => s.close());
    sockets = [];
  });

  async function rooms() {
    const [moderator, host, presentation] = await Promise.all([
      connectSocket(ctx, { cookie: modCookie }),
      connectSocket(ctx, { cookie: hostCookie }),
      connectSocket(ctx, { room: 'presentation' }),
    ]);
    sockets.push(moderator, host, presentation);
    return {
      moderator: recordEvents(moderator),
      host: recordEvents(host),
      presentation: recordEvents(presentation),
    };
  }

  const mod = (method: 'get' | 'patch', path: string) =>
    ctx.http()[method](path).set('Cookie', modCookie);
  const host = (method: 'get' | 'patch', path: string) =>
    ctx.http()[method](path).set('Cookie', hostCookie);

  /** Submits a question and returns its id (read via the moderator dashboard). */
  async function createQuestion(content = 'How do I get started with Docker?') {
    await submit(ctx, { content }).expect(201);
    const { body } = await mod('get', '/moderator/questions').expect(200);
    return body.pending.find((q: any) => q.content === content).id as string;
  }

  async function toHostApproved(content?: string) {
    const id = await createQuestion(content);
    await mod('patch', `/moderator/questions/${id}/approve`).expect(200);
    await host('patch', `/host/questions/${id}/approve`).expect(200);
    return id;
  }

  it('runs the main flow end to end with realtime events', async () => {
    const r = await rooms();

    await submit(ctx, { displayName: '  Ada  ' }).expect(201, {
      received: true,
    });
    const created = await r.moderator.waitFor('QUESTION_CREATED');
    expect(created).toMatchObject({
      status: 'PENDING',
      displayName: 'Ada',
      source: 'LIVE',
      category: { slug: 'web-development', name: 'Web Development' },
    });
    expect(created).not.toHaveProperty('participantSessionId');

    await mod('patch', `/moderator/questions/${created.id}/approve`).expect(
      200,
    );
    expect(await r.host.waitFor('QUESTION_READY_FOR_HOST')).toMatchObject({
      id: created.id,
    });

    const current = await host('get', '/host/question').expect(200);
    expect(current.body.question).toMatchObject({
      id: created.id,
      displayName: 'Ada',
    });

    await host('patch', `/host/questions/${created.id}/approve`).expect(200);
    expect(await r.moderator.waitFor('QUESTION_HOST_APPROVED')).toMatchObject({
      id: created.id,
      status: 'HOST_APPROVED',
    });
    expect((await host('get', '/host/question')).body.question).toBeNull();

    await mod('patch', `/moderator/questions/${created.id}/display`).expect(
      200,
    );
    const displayed = await r.presentation.waitFor('QUESTION_DISPLAYED');
    expect(displayed).toEqual({
      id: created.id,
      content: created.content,
      displayName: 'Ada',
      category: { name: 'Web Development', slug: 'web-development' },
    });
    const screen = await ctx.http().get('/presentation/current').expect(200);
    expect(screen.body.question.id).toBe(created.id);

    await mod('patch', `/moderator/questions/${created.id}/answer`).expect(200);
    await r.presentation.waitFor('QUESTION_ANSWERED');
    expect(
      (await ctx.http().get('/presentation/current')).body.question,
    ).toBeNull();

    const dashboard = await mod('get', '/moderator/questions').expect(200);
    expect(dashboard.body).toMatchObject({
      pending: [],
      awaitingHost: [],
      ready: [],
      displayed: null,
      previous: { id: created.id, status: 'ANSWERED' },
    });
  });

  it('never sends a moderator rejection to the host', async () => {
    const r = await rooms();
    const id = await createQuestion();

    await mod('patch', `/moderator/questions/${id}/reject`).expect(200);
    await r.moderator.waitFor('QUESTION_MODERATOR_REJECTED');
    await settle();

    expect(r.host.names()).toEqual([]);
    expect((await host('get', '/host/question')).body.question).toBeNull();
    await host('patch', `/host/questions/${id}/approve`).expect(409);
  });

  it('never sends a host rejection to the presentation', async () => {
    const r = await rooms();
    const id = await createQuestion();
    await mod('patch', `/moderator/questions/${id}/approve`).expect(200);

    await host('patch', `/host/questions/${id}/reject`).expect(200);
    await r.moderator.waitFor('QUESTION_HOST_REJECTED');
    await mod('patch', `/moderator/questions/${id}/display`).expect(409);
    await settle();

    expect(r.presentation.names()).toEqual([]);
  });

  it('shows the host only the oldest waiting question', async () => {
    const first = await createQuestion('First question for the host?');
    const second = await createQuestion('Second question for the host?');
    await mod('patch', `/moderator/questions/${first}/approve`).expect(200);
    await mod('patch', `/moderator/questions/${second}/approve`).expect(200);

    const { body } = await host('get', '/host/question').expect(200);
    expect(body.question.id).toBe(first);
    expect(Object.keys(body)).toEqual(['question']);
  });

  it('marks the displayed question answered when another is displayed', async () => {
    const first = await toHostApproved('First question on screen?');
    const second = await toHostApproved('Second question on screen?');
    const r = await rooms();

    await mod('patch', `/moderator/questions/${first}/display`).expect(200);
    await mod('patch', `/moderator/questions/${second}/display`).expect(200);
    await settle();

    expect(r.presentation.names()).toEqual([
      'QUESTION_DISPLAYED',
      'QUESTION_ANSWERED',
      'QUESTION_DISPLAYED',
    ]);
    const { body } = await mod('get', '/moderator/questions');
    expect(body.displayed.id).toBe(second);
    expect(body.previous.id).toBe(first);
    expect(
      await ctx.prisma.question.count({ where: { status: 'DISPLAYED' } }),
    ).toBe(1);
  });

  it('remove returns the question to the ready list and blanks the screen', async () => {
    const id = await toHostApproved();
    await mod('patch', `/moderator/questions/${id}/display`).expect(200);
    const r = await rooms();

    const res = await mod('patch', `/moderator/questions/${id}/remove`).expect(
      200,
    );
    expect(res.body.status).toBe('HOST_APPROVED');
    expect(await r.presentation.waitFor('QUESTION_REMOVED')).toEqual({ id });
    expect(
      (await ctx.http().get('/presentation/current')).body.question,
    ).toBeNull();
    expect((await mod('get', '/moderator/questions')).body.ready[0].id).toBe(
      id,
    );
  });

  it('rejects transitions from the wrong state', async () => {
    const id = await createQuestion();
    await mod('patch', `/moderator/questions/${id}/display`).expect(409);
    await mod('patch', `/moderator/questions/${id}/approve`).expect(200);
    await mod('patch', `/moderator/questions/${id}/approve`).expect(409);
    await mod('patch', `/moderator/questions/${id}/answer`).expect(409);
    await mod('patch', `/moderator/questions/${id}/rollback`).expect(409);
    await mod(
      'patch',
      '/moderator/questions/00000000-0000-4000-8000-000000000000/approve',
    ).expect(404);
    await mod('patch', '/moderator/questions/not-a-uuid/approve').expect(400);
  });

  describe('displaying without waiting for the host', () => {
    it('lets the moderator display a question the host has not reviewed', async () => {
      const id = await createQuestion('Can the moderator skip the host?');
      await mod('patch', `/moderator/questions/${id}/approve`).expect(200);
      const r = await rooms();

      const res = await mod(
        'patch',
        `/moderator/questions/${id}/display`,
      ).expect(200);
      expect(res.body).toMatchObject({
        status: 'DISPLAYED',
        hostApprovedAt: null,
      });
      expect(await r.presentation.waitFor('QUESTION_DISPLAYED')).toMatchObject({
        id,
      });
      expect(await r.host.waitFor('QUESTION_DISPLAYED')).toEqual({ id });

      // The host's view moves on, and a late click can't act on it.
      expect((await host('get', '/host/question')).body.question).toBeNull();
      await host('patch', `/host/questions/${id}/approve`).expect(409);
    });

    it('returns a skipped question to the host queue when removed', async () => {
      const id = await createQuestion('Back to the host after removal?');
      await mod('patch', `/moderator/questions/${id}/approve`).expect(200);
      await mod('patch', `/moderator/questions/${id}/display`).expect(200);
      const r = await rooms();

      const res = await mod(
        'patch',
        `/moderator/questions/${id}/remove`,
      ).expect(200);
      expect(res.body.status).toBe('MODERATOR_APPROVED');
      expect(await r.host.waitFor('QUESTION_READY_FOR_HOST')).toMatchObject({
        id,
      });
      expect((await host('get', '/host/question')).body.question.id).toBe(id);
    });

    it('still never displays a question the host rejected', async () => {
      const id = await createQuestion();
      await mod('patch', `/moderator/questions/${id}/approve`).expect(200);
      await host('patch', `/host/questions/${id}/reject`).expect(200);
      await mod('patch', `/moderator/questions/${id}/display`).expect(409);
    });
  });

  describe('rolling back to the previous question', () => {
    it('re-displays the previous question and returns the current one to ready', async () => {
      const first = await toHostApproved('First question shown?');
      const second = await toHostApproved('Second question shown?');
      await mod('patch', `/moderator/questions/${first}/display`).expect(200);
      await mod('patch', `/moderator/questions/${second}/display`).expect(200);
      const r = await rooms();

      const res = await mod(
        'patch',
        `/moderator/questions/${first}/rollback`,
      ).expect(200);
      expect(res.body).toMatchObject({
        id: first,
        status: 'DISPLAYED',
        answeredAt: null,
      });
      await settle();
      expect(r.presentation.names()).toEqual([
        'QUESTION_REMOVED',
        'QUESTION_DISPLAYED',
      ]);
      expect(
        (await ctx.http().get('/presentation/current')).body.question.id,
      ).toBe(first);

      const { body } = await mod('get', '/moderator/questions');
      expect(body.displayed.id).toBe(first);
      expect(body.ready.map((q: any) => q.id)).toEqual([second]);
      expect(body.previous).toBeNull();
    });

    it('walks back through the history and works from the idle screen', async () => {
      const a = await toHostApproved('Question A?');
      const b = await toHostApproved('Question B?');
      for (const id of [a, b]) {
        await mod('patch', `/moderator/questions/${id}/display`).expect(200);
        await mod('patch', `/moderator/questions/${id}/answer`).expect(200);
      }

      await mod('patch', `/moderator/questions/${a}/rollback`).expect(409);
      await mod('patch', `/moderator/questions/${b}/rollback`).expect(200);
      expect((await mod('get', '/moderator/questions')).body.previous.id).toBe(
        a,
      );
      await mod('patch', `/moderator/questions/${a}/rollback`).expect(200);
      expect(
        (await ctx.http().get('/presentation/current')).body.question.id,
      ).toBe(a);
    });

    it('rejects unknown questions', async () => {
      await mod(
        'patch',
        '/moderator/questions/00000000-0000-4000-8000-000000000000/rollback',
      ).expect(404);
    });
  });

  it('applies a double click only once', async () => {
    const id = await createQuestion();
    const results = await Promise.all([
      mod('patch', `/moderator/questions/${id}/approve`),
      mod('patch', `/moderator/questions/${id}/approve`),
    ]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);
  });

  it('pause, resume and end control submissions', async () => {
    const r = await rooms();

    await mod('patch', '/moderator/event/pause').expect(200);
    await r.moderator.waitFor('SUBMISSIONS_PAUSED');
    expect((await ctx.http().get('/event/status')).body).toEqual({
      submissionsOpen: false,
      ended: false,
    });
    await submit(ctx).expect(403);

    await mod('patch', '/moderator/event/resume').expect(200);
    await r.moderator.waitFor('SUBMISSIONS_RESUMED');
    await submit(ctx).expect(201);

    const id = await toHostApproved('Displayed when the event ends?');
    await mod('patch', `/moderator/questions/${id}/display`).expect(200);

    const end = await mod('patch', '/moderator/event/end').expect(200);
    expect(end.body).toMatchObject({ submissionsOpen: false, ended: true });
    await r.presentation.waitFor('EVENT_ENDED');
    await r.host.waitFor('EVENT_ENDED');
    expect(
      (await ctx.http().get('/presentation/current')).body.question,
    ).toBeNull();
    await submit(ctx).expect(403);
    await mod('patch', '/moderator/event/resume').expect(409);
  });
});
