import {
  HOST,
  MODERATOR,
  type TestContext,
  connectSocket,
  createTestApp,
  login,
  resetDatabase,
  submit,
} from './helpers.js';

describe('Security and validation (SPEC §8, §9)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
  });

  describe('question validation', () => {
    it.each([
      ['an unknown category', { category: 'cooking' }],
      ['an inactive category', { category: 'retired' }],
      ['a short question', { content: 'too short' }],
      ['a whitespace-padded short question', { content: '    short    ' }],
      ['a long question', { content: 'x'.repeat(501) }],
      ['a long display name', { displayName: 'n'.repeat(51) }],
      ['an unexpected field', { status: 'DISPLAYED' }],
      ['a non-string question', { content: 12345678901 }],
    ])('rejects %s', async (_label, body) => {
      await submit(ctx, body).expect(400);
      expect(await ctx.prisma.question.count()).toBe(0);
    });

    it('accepts boundary lengths and stores an empty display name as anonymous', async () => {
      await submit(ctx, {
        content: 'x'.repeat(500),
        displayName: 'n'.repeat(50),
      }).expect(201);
      await submit(ctx, { content: 'y'.repeat(10), displayName: '   ' }).expect(
        201,
      );
      const anonymous = await ctx.prisma.question.findFirst({
        where: { content: 'y'.repeat(10) },
      });
      expect(anonymous?.displayName).toBeNull();
    });

    it('rejects oversized request bodies', async () => {
      await submit(ctx, { content: 'x'.repeat(20_000) }).expect(413);
    });
  });

  describe('participant rate limiting', () => {
    it('enforces the per-session cooldown', async () => {
      const first = await submit(ctx).expect(201);
      const cookie = ([] as string[])
        .concat(first.headers['set-cookie'] ?? [])
        .find((c) => c.startsWith('mt_sid='))!
        .split(';')[0];

      const second = await submit(ctx, {}, cookie).expect(429);
      expect(second.body.retryAfterSeconds).toBeGreaterThan(0);

      // A different session (e.g. another student on the same NAT) is unaffected.
      await submit(ctx).expect(201);
    });

    it('enforces the per-session 30-minute maximum', async () => {
      const sessionId = '11111111-1111-4111-8111-111111111111';
      const category = await ctx.prisma.category.findUniqueOrThrow({
        where: { slug: 'general' },
      });
      await ctx.prisma.question.createMany({
        data: [1, 2, 3, 4, 5].map((minutesAgo) => ({
          categoryId: category.id,
          content: `Earlier question ${minutesAgo}`,
          participantSessionId: sessionId,
          source: 'LIVE' as const,
          createdAt: new Date(Date.now() - minutesAgo * 60_000),
        })),
      });

      await submit(ctx, {}, `mt_sid=${sessionId}`).expect(429);
    });
  });

  describe('authorization', () => {
    it('rejects bad credentials with a generic message', async () => {
      const unknown = await ctx
        .http()
        .post('/auth/login')
        .send({ username: 'nobody', password: 'x' })
        .expect(401);
      const wrong = await ctx
        .http()
        .post('/auth/login')
        .send({ ...MODERATOR, password: 'wrong' })
        .expect(401);
      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it('sets an HTTP-only auth cookie and exposes /auth/me', async () => {
      const res = await ctx
        .http()
        .post('/auth/login')
        .send(MODERATOR)
        .expect(200);
      expect(String(res.headers['set-cookie'])).toMatch(/mt_auth=.*HttpOnly/);
      const cookie = await login(ctx, MODERATOR);
      const me = await ctx
        .http()
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);
      expect(me.body.user).toMatchObject({
        username: MODERATOR.username,
        role: 'MODERATOR',
      });
      expect(me.body.user).not.toHaveProperty('passwordHash');
    });

    it('requires authentication for internal endpoints', async () => {
      await ctx.http().get('/auth/me').expect(401);
      await ctx.http().get('/moderator/questions').expect(401);
      await ctx.http().patch('/moderator/event/pause').expect(401);
      await ctx.http().get('/host/question').expect(401);
      await ctx
        .http()
        .get('/moderator/questions')
        .set('Cookie', 'mt_auth=forged.token.value')
        .expect(401);
    });

    it('enforces roles on the server', async () => {
      const hostCookie = await login(ctx, HOST);
      const modCookie = await login(ctx, MODERATOR);
      const id = '00000000-0000-4000-8000-000000000000';

      await ctx
        .http()
        .get('/moderator/questions')
        .set('Cookie', hostCookie)
        .expect(403);
      await ctx
        .http()
        .patch(`/moderator/questions/${id}/display`)
        .set('Cookie', hostCookie)
        .expect(403);
      await ctx
        .http()
        .patch('/moderator/event/end')
        .set('Cookie', hostCookie)
        .expect(403);
      await ctx
        .http()
        .get('/host/question')
        .set('Cookie', modCookie)
        .expect(403);
      await ctx
        .http()
        .patch(`/host/questions/${id}/approve`)
        .set('Cookie', modCookie)
        .expect(403);
    });

    it('revokes access when the user is deleted', async () => {
      const cookie = await login(ctx, MODERATOR);
      await ctx.prisma.user.delete({ where: { username: MODERATOR.username } });
      await ctx
        .http()
        .get('/moderator/questions')
        .set('Cookie', cookie)
        .expect(401);
    });

    it('refuses unauthenticated sockets outside the presentation room', async () => {
      await expect(connectSocket(ctx, {})).rejects.toThrow('unauthorized');
      await expect(connectSocket(ctx, { room: 'moderator' })).rejects.toThrow(
        'unauthorized',
      );
      const presentation = await connectSocket(ctx, { room: 'presentation' });
      presentation.close();
    });
  });

  it('reports database health', async () => {
    await ctx
      .http()
      .get('/health')
      .expect(200, { status: 'ok', database: 'up' });
  });
});
