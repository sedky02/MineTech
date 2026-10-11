# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**MineTech** is a live Q&A platform for a university club tech event (audience: 1st/2nd year students, 3–4 speakers, 1 host). Students submit questions anonymously; a moderator filters them, the host approves them, and the moderator puts them on a projector screen.

The full specification is in [docs/SPEC.md](docs/SPEC.md). Read it before implementing any feature, and check its **Open Questions** section before making a decision it doesn't settle. Ask instead of guessing on those.

## Layout

Two independent npm apps in one repo (no workspace tooling):

```text
backend/             NestJS 12 (ESM) + Socket.IO + Prisma 7 + PostgreSQL → Render
  prisma/            schema.prisma, migrations, seed.ts
  src/questions/     state machine (questions.service.ts) + role controllers
  src/realtime/      Socket.IO gateway, rooms, event names
  test/              e2e tests (real Postgres + real Socket.IO clients)
frontend/            Next.js 16 (App Router) + React 19 → Vercel
  app/               routes: /, /login, /moderator, /host, /presentation
  components/        participant/, moderator/, host/, presentation/, ui/
  hooks/             useAuth, useSocket (reconnect + REST resync), useQuestions
  lib/               api/, socket/, auth/, validation/, config.ts
docker-compose.yml   local PostgreSQL (port 5433) + test database
render.yaml          Render Blueprint for the backend
docs/SPEC.md         specification
```

## Commands

```bash
docker compose up -d                      # local Postgres (minetech + minetech_test)

cd backend
npm run start:dev                         # API on :4000 (needs backend/.env, see .env.example)
npm run db:migrate                        # create/apply a migration after editing schema.prisma
npm run db:seed                           # SEED_* accounts (idempotent)
npm run user:create -- <name> <MODERATOR|HOST>   # add/reset an account
npm run lint && npm test && npm run test:e2e     # e2e needs the Docker DB running
npm run build

cd frontend
npm run dev                               # http://localhost:3000 (needs frontend/.env.local)
npm run lint && npm run typecheck && npm run build
```

Run the backend e2e suite after any change to questions, auth, event or realtime code. It covers every acceptance criterion in SPEC §20.

## Codebase conventions

- **Backend is ESM.** Relative imports need the `.js` extension (`'./questions.service.js'`). Avoid import cycles: decorator metadata breaks under ESM cycles (shared constants live in `src/common/constants.ts`).
- **Prisma 7**: the client is generated into `backend/src/generated/prisma` (git-ignored, rebuilt by `postinstall`/`build`) and uses the `@prisma/adapter-pg` driver adapter. Run `npx prisma generate` after editing the schema. Constraints Prisma can't express (single `DISPLAYED` row, single-row `event_state`, the fixed topic list) are raw SQL in the migrations.
- **Next.js 16 differs from older versions.** Read `frontend/AGENTS.md` and the bundled docs in `frontend/node_modules/next/dist/docs/` before using an unfamiliar API. The `react-hooks` lint rules forbid synchronous `setState` inside effects: set state in promise callbacks instead.
- `socket.io` (backend) and `socket.io-client` (frontend) are pinned to the exact version `@nestjs/platform-socket.io` depends on. Upgrade them together.
- Socket event names exist twice: `backend/src/realtime/realtime.events.ts` and `frontend/lib/socket/events.ts`. Keep them identical.
- Frontend components treat socket events as "refetch now" signals (the presentation applies `QUESTION_DISPLAYED` payloads directly for speed). Never patch local state in a way that can drift from the DB.

## Non-negotiable rules

1. **PostgreSQL is the source of truth.** Write to the DB first, then emit the socket event. Never keep authoritative state in memory (no in-memory question arrays, no in-memory "current displayed question").
2. **Authorization is server-side.** Every moderator/host endpoint and socket connection checks identity, role, and that the state transition is allowed from the question's *current* DB state. Hiding UI is not authorization.
3. **State transitions are enforced in one place** (the questions service), using the transition table in SPEC.md §4. Make transitions atomic (e.g. conditional `UPDATE ... WHERE status = <expected>`) so concurrent clicks can't double-apply.
4. **Never report success on failure.** If the DB write fails, the participant gets an error, not a confirmation.
5. **Validate on the server.** Question 1–500 chars (not blank), display name ≤ 50, category from allowlist, reject unknown fields (`whitelist` + `forbidNonWhitelisted` in Nest's `ValidationPipe`).
6. **Escape user content.** Never use `dangerouslySetInnerHTML` for questions or names.
7. **Rate limit by session *and* IP**, never by IP alone (campus NAT). Session limits (1 per 12 s, max 5 per 30 min) are checked against the DB under a per-session advisory lock; values are in `backend/src/common/constants.ts`.
8. **Clients must survive reconnects.** On socket (re)connect: authenticate → fetch current state via REST → replace UI state. Never assume every event arrived.

## Question state machine

```text
PENDING → MODERATOR_APPROVED → HOST_APPROVED → DISPLAYED ⇄ ANSWERED
   ↓               ↓    └──── skip host ───────────┘  (rollback)
REJECTED        REJECTED
(moderator)     (host)
```

- Moderator: `PENDING → MODERATOR_APPROVED | REJECTED`, `HOST_APPROVED → DISPLAYED`, `MODERATOR_APPROVED → DISPLAYED` (skip the host), `DISPLAYED → ANSWERED`, `DISPLAYED → back where it came from` (remove), `latest ANSWERED → DISPLAYED` (rollback).
- "Back where it came from" = `HOST_APPROVED` if `host_approved_at` is set, else `MODERATOR_APPROVED` (host queue). Remove and rollback both use this (`statusBeforeDisplay` in the questions service).
- Lists are ordered by `position` (then `created_at`). Entering a list sets `position` to the current time (end of list); `PATCH /moderator/questions/reorder` permutes the positions of the given ids only. The host sees the first `MODERATOR_APPROVED` by position. The frontend mirrors this rule for optimistic updates (`applySubsetOrder` in `hooks/useQuestions.ts`).
- Host: `MODERATOR_APPROVED → HOST_APPROVED | REJECTED`.
- Topics (categories) are a fixed list, not a table: `backend/src/common/categories.ts` and `frontend/lib/categories.ts` (keep them identical). Questions store the slug in `questions.category`, guarded by a CHECK constraint, so changing the list needs a migration too. There is no topic management UI.
- At most one question is `DISPLAYED` at a time. Displaying a new question auto-marks the current one `ANSWERED`, in the same transaction.
- Remove, answer and "clear display" leave the presentation on the **idle screen** (event logo + event name). Clear display is just remove on the current question.
- There is no "End event" action (removed after an accidental use in production); Pause is the way to stop submissions. Don't reintroduce an irreversible event-level action.
- The moderator dashboard shows the **previous question** (most recently answered).
- `source` (`PRE_EVENT`/`LIVE`) is informational only, derived from `EVENT_STARTS_AT`.
- Set the matching timestamp column (`moderator_approved_at`, `host_rejected_at`, …) on every transition.
- Auth: JWT in an HTTP-only cookie (`mt_auth`), Bearer header accepted as a fallback, all in `src/common/guards/auth.guard.ts`. The transport is still an open question (third-party cookie blocking): keep it isolated in the guard and the socket middleware.

## Role boundaries

| Role | Sees | Never sees |
| --- | --- | --- |
| Participant | Category picker, question box, optional name, confirmation | Other questions, statuses, votes |
| Host | One `MODERATOR_APPROVED` question + Approve/Reject | Queue, moderation, presentation or event controls |
| Moderator | Everything; operates the system | — |
| Presentation | Current `DISPLAYED` question + branding | Any controls |

Keep the host UI minimal. Don't add features to it.

## Realtime

- Participants use REST only, no sockets.
- Socket.IO rooms: `moderator`, `host`, `presentation`.
- Event names are fixed in SPEC.md §12 (`QUESTION_CREATED`, `QUESTION_READY_FOR_HOST`, `QUESTION_DISPLAYED`, …). Share them as a constant/enum rather than string literals scattered across code.
- Only emit to the room that should receive the event: a rejected question must never reach `host` or `presentation`.

## Scope guardrails

Single event, single backend instance. Do **not** introduce Redis, message queues, Kubernetes, microservices, multi-instance setups, or a multi-event abstraction. Do not add participant accounts, upvoting, or a public question feed.

## Deployment notes

- Backend listens on `process.env.PORT` and `0.0.0.0`, exposes `GET /health`, and shuts down gracefully (`app.enableShutdownHooks()`).
- Render's free plan sleeps: every page pings `GET /health` once on first load (`components/ui/ServerWakeUp.tsx`, `lib/api/wake.ts`). If a question send hangs or fails because the server is asleep, the participant form shows a floating notice, checks `/health` until it answers, then says they can send again. It never re-sends by itself (no duplicate questions, rule 4).
- First launch of the participant page: `components/participant/ParticipantShell.tsx` shows only the MineTech logo, centred, as the loading screen, then glides that same element onto the header logo (Web Animations API; skipped under reduced motion) and fades the form in. The last event status is cached in localStorage (`lib/participant-cache.ts`): a returning student gets the form at once while the server answers, and a failed refresh is ignored. The server stays the source of truth.
- CORS: the exact Vercel origin from `CORS_ORIGIN`, never `*`, with credentials enabled.
- Frontend reads only `NEXT_PUBLIC_*` variables (API/WS URLs, event name). Never put secrets there.
- Render build must be `npm ci --include=dev && npm run build` (the Nest CLI is a dev dependency).
- Passwords: Argon2id. Cookies: HTTP-only; `Secure` + `SameSite=None` in production (different sites), `Lax` in development.

## Design

Minecraft-inspired: pixel/block UI, club logo, event marketing assets. The participant page is mobile-first. The presentation page must be readable from the back of a lecture hall on a projector.

- Theme tokens and block primitives (`.btn`, `.panel`, `.input`, `.alert`) are in `frontend/app/globals.css`; page styles are CSS modules next to their components.
- Background: `components/ui/MinecraftSky.tsx` (mounted once in `app/layout.tsx`, fixed at `z-index: -1`) draws the animated night sky for every page, the projector included: pixel stars that blink briefly, a square moon (hidden under 640px), and blocky clouds drifting one way. Keep it faint (cloud opacity ≤ 0.07) and slow, animate only `transform`/`opacity`, never add back-and-forth or full-screen motion, and keep the `prefers-reduced-motion` freeze. Page content sits on opaque panels.
- In CSS modules, target the global theme classes with `:global(.btn)` / `:global(.input)`; a bare `.btn` is renamed and silently matches nothing.
- Fonts: `--font-display` (headings, panel titles, category tags) is Minecraft Ten, falling back to Press Start 2P; Pixelify Sans is everything else, including student questions (it covers accented letters). Ligatures are disabled globally because Pixelify's "fi" reads as "A".
- Projector transitions live in `PresentationScreen.tsx` (`useDepartingQuestion` keeps a cleared question mounted for `EXIT_MS` = 280ms so it can animate out) and `presentation.module.css` (`place` enter 500ms, `leave` exit 240ms, `arrive` idle fade-in). Keep `EXIT_MS` a little longer than the CSS exit duration. Use smooth easing, never `steps()`, on large elements: stepped motion reads as stutter at projector size.
- The projected question text (`/presentation`) uses **Google Sans** (the GDG lockup's typeface, via `next/font/google` in `PresentationScreen.tsx`, so only that route loads it): a clean reading face with accented letters for long text on a projector.
- Minecraft Ten (FontSpace, "Freeware, Non-Commercial", no accented letters) lives at `public/fonts/minecraft-ten.ttf`, which is **git-ignored** so it isn't redistributed through the repo. `globals.css` loads it via `@font-face` with `size-adjust: 143%` (matches Press Start 2P's cap height, which the heading sizes were tuned for). Without the file (e.g. a deploy from git), headings fall back to Press Start 2P.
- Logo: `public/MineTechLogo.svg` (wide MINETECH wordmark, ~5:1) via `WordmarkLogo`/`Wordmark` in `components/ui/Logo.tsx`, used in page headers and on the projector. `public/logo.svg` (and `app/icon.svg`) is the square grass-block icon for small square spots (favicon, loading, empty states).
