import type { Socket } from 'socket.io-client';
import { slugify } from '../src/categories/categories.service.js';
import {
  HOST,
  MODERATOR,
  type TestContext,
  connectSocket,
  createTestApp,
  login,
  recordEvents,
  resetDatabase,
  submit,
} from './helpers.js';

describe('Topic management (moderator)', () => {
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

  const mod = () => ({
    list: () =>
      ctx.http().get('/moderator/categories').set('Cookie', modCookie),
    create: (name: unknown) =>
      ctx
        .http()
        .post('/moderator/categories')
        .set('Cookie', modCookie)
        .send({ name }),
    update: (id: string, body: object) =>
      ctx
        .http()
        .patch(`/moderator/categories/${id}`)
        .set('Cookie', modCookie)
        .send(body),
    remove: (id: string) =>
      ctx.http().delete(`/moderator/categories/${id}`).set('Cookie', modCookie),
  });
  const idOf = async (slug: string) =>
    (await ctx.prisma.category.findUniqueOrThrow({ where: { slug } })).id;
  const publicSlugs = async () =>
    (await ctx.http().get('/categories').expect(200)).body.map(
      (c: { slug: string }) => c.slug,
    );

  it('lists every topic, hidden ones included, with question counts', async () => {
    await submit(ctx, { category: 'general' }).expect(201);
    const { body } = await mod().list().expect(200);
    expect(body.map((c: any) => [c.slug, c.isActive, c.questionCount])).toEqual(
      [
        ['web-development', true, 0],
        ['general', true, 1],
        ['retired', false, 0],
      ],
    );
  });

  it('adds a topic at the end, with a generated slug students can use', async () => {
    const res = await mod().create('  Game   Development ').expect(201);
    expect(res.body).toMatchObject({
      name: 'Game Development',
      slug: 'game-development',
      isActive: true,
      questionCount: 0,
      displayOrder: 4,
    });
    expect(await publicSlugs()).toContain('game-development');
    await submit(ctx, { category: 'game-development' }).expect(201);
  });

  it('rejects duplicate names (case-insensitive) and keeps slugs unique', async () => {
    await mod().create('general').expect(409);
    await ctx.prisma.category.update({
      where: { slug: 'retired' },
      data: { name: 'Old' },
    });
    await mod()
      .create('Retired')
      .expect(201)
      .expect((r) => expect(r.body.slug).toBe('retired-2'));
  });

  it('validates names', async () => {
    await mod().create('').expect(400);
    await mod().create('   ').expect(400);
    await mod().create('x'.repeat(41)).expect(400);
    await mod().create(42).expect(400);
    await ctx
      .http()
      .post('/moderator/categories')
      .set('Cookie', modCookie)
      .send({ name: 'Ok', slug: 'hack' })
      .expect(400);
  });

  it('renames without changing the slug', async () => {
    const id = await idOf('general');
    const res = await mod()
      .update(id, { name: 'General Questions' })
      .expect(200);
    expect(res.body).toMatchObject({
      name: 'General Questions',
      slug: 'general',
    });
    await mod().update(id, { name: 'Web Development' }).expect(409);
    await mod().update(id, {}).expect(400);
  });

  it('hiding removes a topic for students but keeps its questions', async () => {
    await submit(ctx, { category: 'general' }).expect(201);
    const id = await idOf('general');
    await mod().update(id, { isActive: false }).expect(200);

    expect(await publicSlugs()).toEqual(['web-development']);
    await submit(ctx, { category: 'general' }).expect(400);
    const { body } = await ctx
      .http()
      .get('/moderator/questions')
      .set('Cookie', modCookie);
    expect(body.pending[0].category.slug).toBe('general');

    await mod().update(id, { isActive: true }).expect(200);
    expect(await publicSlugs()).toEqual(['web-development', 'general']);
  });

  it('deletes only unused topics', async () => {
    await submit(ctx, { category: 'general' }).expect(201);
    const used = await mod()
      .remove(await idOf('general'))
      .expect(409);
    expect(used.body.message).toMatch(/has 1 question\. Hide it instead/);

    await mod()
      .remove(await idOf('retired'))
      .expect(204);
    expect((await mod().list()).body.map((c: any) => c.slug)).toEqual([
      'web-development',
      'general',
    ]);
    await mod().remove('00000000-0000-4000-8000-000000000000').expect(404);
  });

  it('always keeps at least one topic visible to students', async () => {
    await mod()
      .update(await idOf('general'), { isActive: false })
      .expect(200);
    const last = await idOf('web-development');
    await mod().update(last, { isActive: false }).expect(409);
    await mod().remove(last).expect(409);
    expect(await publicSlugs()).toEqual(['web-development']);
  });

  it('is moderator-only', async () => {
    const id = await idOf('general');
    await ctx.http().get('/moderator/categories').expect(401);
    await ctx
      .http()
      .get('/moderator/categories')
      .set('Cookie', hostCookie)
      .expect(403);
    await ctx
      .http()
      .post('/moderator/categories')
      .set('Cookie', hostCookie)
      .send({ name: 'X' })
      .expect(403);
    await ctx
      .http()
      .patch(`/moderator/categories/${id}`)
      .set('Cookie', hostCookie)
      .send({ isActive: false })
      .expect(403);
    await ctx
      .http()
      .delete(`/moderator/categories/${id}`)
      .set('Cookie', hostCookie)
      .expect(403);
  });

  it('tells moderator screens when topics change', async () => {
    const socket = await connectSocket(ctx, { cookie: modCookie });
    sockets.push(socket);
    const events = recordEvents(socket);
    await mod().create('Robotics').expect(201);
    await events.waitFor('CATEGORIES_UPDATED');
  });
});

describe('slugify', () => {
  it.each([
    ['AI & Data', 'ai-data'],
    ['  DevOps / Cloud  ', 'devops-cloud'],
    ['Économie numérique', 'economie-numerique'],
    ['!!!', 'topic'],
  ])('%s → %s', (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });
});
