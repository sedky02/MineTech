# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

**MineTech** is a live Q&A platform for a university club tech event (audience: 1st/2nd year students, 3–4 speakers, 1 host). Students submit questions anonymously; a moderator filters them, the host approves them, and the moderator puts them on a projector screen.

The full specification is in [docs/SPEC.md](docs/SPEC.md). Read it before implementing any feature, and check its **Open Questions** section before making a decision it doesn't settle. Ask instead of guessing on those.

## Status

Greenfield: no code yet. Follow the development order in SPEC.md §19 (backend foundation → participant → moderator → host → WebSockets → presentation → design → deployment).

Planned layout (two apps, one repo):

```text
frontend/   Next.js + React + TypeScript (Vercel)
backend/    NestJS + TypeScript + Socket.IO + Prisma (Render)
docs/       Specification
```

Update this file with real build/test/lint commands once each app is scaffolded.

## Non-negotiable rules

1. **PostgreSQL is the source of truth.** Write to the DB first, then emit the socket event. Never keep authoritative state in memory (no in-memory question arrays, no in-memory "current displayed question").
2. **Authorization is server-side.** Every moderator/host endpoint and socket connection checks identity, role, and that the state transition is allowed from the question's *current* DB state. Hiding UI is not authorization.
3. **State transitions are enforced in one place** (the questions service), using the transition table in SPEC.md §4. Make transitions atomic (e.g. conditional `UPDATE ... WHERE status = <expected>`) so concurrent clicks can't double-apply.
4. **Never report success on failure.** If the DB write fails, the participant gets an error, not a confirmation.
5. **Validate on the server.** Question 10–500 chars, display name ≤ 50, category from allowlist, reject unknown fields (`whitelist` + `forbidNonWhitelisted` in Nest's `ValidationPipe`).
6. **Escape user content.** Never use `dangerouslySetInnerHTML` for questions or names.
7. **Rate limit by session *and* IP**, never by IP alone (campus NAT). Session: 1 per 10–15 s, max 5 per 30 min.
8. **Clients must survive reconnects.** On socket (re)connect: authenticate → fetch current state via REST → replace UI state. Never assume every event arrived.

## Question state machine

```text
PENDING → MODERATOR_APPROVED → HOST_APPROVED → DISPLAYED → ANSWERED
   ↓               ↓
REJECTED        REJECTED
(moderator)     (host)
```

- Moderator: `PENDING → MODERATOR_APPROVED | REJECTED`, `HOST_APPROVED → DISPLAYED`, `DISPLAYED → ANSWERED`, `DISPLAYED → HOST_APPROVED` (remove).
- Host: `MODERATOR_APPROVED → HOST_APPROVED | REJECTED`.
- At most one question is `DISPLAYED` at a time. Displaying a new question auto-marks the current one `ANSWERED`, in the same transaction.
- Remove, answer, "clear display" and "end event" all leave the presentation on the **idle screen** (event logo + event name). Clear display is just remove on the current question. End event also closes submissions for good.
- The moderator dashboard shows the **previous question** (most recently answered).
- `source` (`PRE_EVENT`/`LIVE`) is informational only, derived from `EVENT_STARTS_AT`.
- Set the matching timestamp column (`moderator_approved_at`, `host_rejected_at`, …) on every transition.
- Auth transport (cookie vs JWT) is undecided. Keep it behind a Nest guard so it can be swapped.

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
- CORS: the exact Vercel origin from `CORS_ORIGIN`, never `*`, with credentials enabled.
- Frontend only reads `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`. Never put secrets in `NEXT_PUBLIC_*`.
- Passwords: Argon2id (or bcrypt). Cookies: HTTP-only, `Secure`, and `SameSite=None` if frontend and backend are on different sites.

## Design

Minecraft-inspired: pixel/block UI, club logo, event marketing assets. The participant page is mobile-first. The presentation page must be readable from the back of a lecture hall on a projector.
