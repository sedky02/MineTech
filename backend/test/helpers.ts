import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import argon2 from 'argon2';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const MODERATOR = { username: 'mod', password: 'moderator-password' };
export const HOST = { username: 'host', password: 'host-password-1' };

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  url: string;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: false,
  });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    prisma: app.get(PrismaService),
    url: `http://127.0.0.1:${port}`,
    http: () => request(app.getHttpServer()),
  };
}

/**
 * Empties questions, re-seeds categories and event state, and makes sure both
 * accounts exist. Accounts are kept between tests so auth cookies stay valid
 * (and the login rate limit isn't hit).
 */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.$executeRawUnsafe('TRUNCATE questions, categories CASCADE');
  await prisma.eventState.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: { submissionsOpen: true },
  });
  await prisma.category.createMany({
    data: [
      { name: 'Web Development', slug: 'web-development', displayOrder: 1 },
      { name: 'General', slug: 'general', displayOrder: 2 },
      { name: 'Retired', slug: 'retired', displayOrder: 3, isActive: false },
    ],
  });
  for (const [account, role] of [
    [MODERATOR, 'MODERATOR'],
    [HOST, 'HOST'],
  ] as const) {
    if (await prisma.user.findUnique({ where: { username: account.username } }))
      continue;
    await prisma.user.create({
      data: {
        username: account.username,
        role,
        passwordHash: await argon2.hash(account.password),
      },
    });
  }
}

/** Logs in and returns the auth cookie header value. */
export async function login(ctx: TestContext, account: typeof MODERATOR) {
  const res = await ctx.http().post('/auth/login').send(account).expect(200);
  const cookie = ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('mt_auth='));
  if (!cookie) throw new Error('No auth cookie');
  return cookie.split(';')[0];
}

export function submit(
  ctx: TestContext,
  body: Record<string, unknown> = {},
  cookie?: string,
) {
  const req = ctx.http().post('/questions');
  if (cookie) req.set('Cookie', cookie);
  return req.send({
    category: 'web-development',
    content: 'What should I learn first as a beginner?',
    ...body,
  });
}

export function connectSocket(
  ctx: TestContext,
  options: { cookie?: string; room?: string },
): Promise<Socket> {
  const socket = io(ctx.url, {
    transports: ['websocket'],
    reconnection: false,
    auth: options.room ? { room: options.room } : {},
    extraHeaders: options.cookie ? { cookie: options.cookie } : undefined,
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => {
      socket.close();
      reject(error);
    });
  });
}

/** Collects every event a socket receives, for later assertions. */
export function recordEvents(socket: Socket) {
  const events: { name: string; payload: any }[] = [];
  socket.onAny((name: string, payload: unknown) =>
    events.push({ name, payload }),
  );
  return {
    events,
    names: () => events.map((e) => e.name),
    waitFor: (name: string, timeoutMs = 2000) =>
      new Promise<any>((resolve, reject) => {
        const found = events.find((e) => e.name === name);
        if (found) return resolve(found.payload);
        const timer = setTimeout(
          () => reject(new Error(`Timed out waiting for ${name}`)),
          timeoutMs,
        );
        socket.on(name, (payload: unknown) => {
          clearTimeout(timer);
          resolve(payload);
        });
      }),
  };
}

export const settle = () => new Promise((resolve) => setTimeout(resolve, 150));
