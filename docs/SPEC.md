# MineTech — Event Q&A Platform Specification

A live Q&A platform for the club's university tech event. Students submit questions before and during the event, a moderator filters them, the host approves them, and approved questions appear on the projector.

---

## 1. Event Context

- University tech event organized by the club
- Audience: mainly 1st and 2nd year students
- 3–4 speakers and 1 host

### Goals

- Let students ask questions before and during the event
- Surface the most relevant and frequent questions
- Help students explore IT domains
- Stop inappropriate questions before they reach the host or the projector
- Keep the host focused on the speakers, not on operating software

---

## 2. Roles

| Role | Account | Responsibility |
| --- | --- | --- |
| Participant | None (anonymous) | Submits questions |
| Moderator | Internal account | Operates the whole system: filters, sends to host, controls the projector, emergency controls |
| Host | Internal account | Approves or rejects one question at a time |
| Presentation | None (public, read-only screen) | Shows the currently displayed question |

---

## 3. Participant Experience

The participant interface must be extremely simple and mobile-first.

**Participant can:**

- Select a category (fixed list)
- Enter one question
- Optionally enter a display name
- Submit (anonymous by default)

**Participant cannot:**

- See other questions
- Upvote questions
- See moderation status
- Access internal dashboards

After submission, show a simple confirmation only. Pre-event and live questions use exactly the same workflow.

### Categories

| Name | Slug |
| --- | --- |
| Web Development | `web-development` |
| AI & Data | `ai-data` |
| Cybersecurity | `cybersecurity` |
| DevOps & Cloud | `devops-cloud` |
| Mobile Development | `mobile-development` |
| Software Engineering | `software-engineering` |
| Career & Studies | `career-studies` |
| General | `general` |

These are the seeded defaults. The moderator manages topics from the dashboard (see [Moderator → Topics](#topics)).

---

## 4. Question Workflow

```text
Participant submits
        ↓
     PENDING
        ↓
   Moderator reviews
      ↙       ↘
 Reject       Approve
                ↓
      MODERATOR_APPROVED
                ↓
          Host reviews ─────────────┐
          ↙          ↘              │ Moderator skips the host
       Reject       Approve         │ (host has no time to review)
                       ↓            │
                HOST_APPROVED       │
                       ↓            │
             Moderator selects      │
                       ↓            │
                  DISPLAYED ◄───────┘
                       ↓      ▲
                  ANSWERED ───┘ Roll back (previous question only)
```

### States

| State | Meaning |
| --- | --- |
| `PENDING` | Submitted, waiting for moderator |
| `MODERATOR_APPROVED` | Passed moderation, waiting for host |
| `REJECTED` | Rejected by moderator or host (timestamps tell which) |
| `HOST_APPROVED` | Ready to be displayed |
| `DISPLAYED` | Currently on the presentation screen |
| `ANSWERED` | Done, out of the active workflow |

### Allowed transitions

The backend enforces these. Any other transition is rejected.

| From | To | Actor | Endpoint |
| --- | --- | --- | --- |
| `PENDING` | `MODERATOR_APPROVED` | Moderator | `PATCH /moderator/questions/:id/approve` |
| `PENDING` | `REJECTED` | Moderator | `PATCH /moderator/questions/:id/reject` |
| `MODERATOR_APPROVED` | `HOST_APPROVED` | Host | `PATCH /host/questions/:id/approve` |
| `MODERATOR_APPROVED` | `REJECTED` | Host | `PATCH /host/questions/:id/reject` |
| `HOST_APPROVED` | `DISPLAYED` | Moderator | `PATCH /moderator/questions/:id/display` |
| `MODERATOR_APPROVED` | `DISPLAYED` | Moderator (skips the host) | `PATCH /moderator/questions/:id/display` |
| `DISPLAYED` | `ANSWERED` | Moderator | `PATCH /moderator/questions/:id/answer` |
| `DISPLAYED` | `HOST_APPROVED`, or `MODERATOR_APPROVED` if it skipped the host | Moderator | `PATCH /moderator/questions/:id/remove` |
| `ANSWERED` (most recent only) | `DISPLAYED` | Moderator | `PATCH /moderator/questions/:id/rollback` |

### Display rules

- **Display while another question is displayed:** the current question is marked `ANSWERED` automatically, and the new one becomes `DISPLAYED`. Both changes happen in a single database transaction.
- **Skip the host:** when the host has no time to review, the moderator can display a question straight from "Waiting for host". The host's view moves on to the next question immediately. `host_approved_at` stays empty, so skipped questions remain identifiable.
- **Remove:** the question goes back to where it came from (`HOST_APPROVED`, or the host's queue if it skipped the host), so it can be displayed again later, and the presentation switches to the idle screen (event logo + event name).
- **Answer:** the question becomes `ANSWERED`, and the presentation switches to the idle screen.
- **Roll back:** re-displays the previous question (the most recently answered one) and clears its `answered_at`. The question on screen, if any, was interrupted rather than answered, so it goes back to where it came from, as with Remove. Rolling back again walks further back through the history. Only the most recent answered question can be rolled back (`409` otherwise).

### Guarantees

- A moderator rejection never reaches the host.
- A host rejection never reaches the presentation (only `MODERATOR_APPROVED` or `HOST_APPROVED` questions can be displayed, never `REJECTED` ones).
- At most one question is `DISPLAYED` at any time.

---

## 5. Moderator Workflow

The moderator is the actual operator of the system.

### Dashboard

- Summary bar: how many questions are to review, with the host, ready, answered and rejected (the to-review count is highlighted when work is waiting, and also shown in the browser tab title)
- Pending questions, questions waiting for the host, and host-approved questions, each in its own list ("To review", "With host", "Ready"); questions under 2 minutes old are tagged "New"
- Category filter (chips with counts) above the three lists
- Currently displayed question
- Previous question: the most recently answered question, so the moderator can see what was just on screen

### Actions

- Approve / Reject (pending questions)
- Display (host-approved questions; auto-answers the current one, see [Display rules](#display-rules))
- Display now, skipping the host (questions waiting for host review)
- Remove (displayed question → idle screen)
- Mark as answered
- Roll back (re-display the previous question)
- Keyboard shortcuts on a focused question card: `A` send to host, `R` reject, `S` show on screen, `Alt+↑/↓` change priority. Focus moves to the next card after an action, so a burst of questions can be cleared without the mouse.
- Every action confirms itself with a short toast; errors stay until dismissed. Only the card being acted on is disabled while a request runs.
- Manage topics (see [Topics](#topics) below)
- Change priority: drag and drop (or ▲/▼) within a list. In "Waiting for host" this decides which question the host sees next; in "Ready to display" it is the moderator's running order.
- Pause / Resume submissions

The moderator decides when a question appears on the presentation.

### Topics

A collapsible **Topics** section at the bottom of the dashboard (set-up work, so it stays out of the live queue):

- **Add** a topic: 1–40 characters, unique (case-insensitive). Its slug is generated from the name ("AI & Data" → `ai-data`; `-2`, `-3`… if taken) and appended to the end of the list.
- **Rename**: changes the display name only. The slug never changes, because questions, colours and filters refer to it.
- **Hide / Show**: hidden topics disappear from the student form (`is_active = false`); their questions keep the topic and can still be filtered.
- **Delete**: only for topics with **no** questions. A used topic must be hidden instead (`409` otherwise).
- At least one topic always stays visible: hiding or deleting the last visible one returns `409` (the button is disabled too).
- New topics without a colour of their own get the fallback block colour (amethyst).
- If a topic is hidden or deleted while a student has the form open, their submit gets "That topic is no longer available. Pick another one." under the topics, the list refreshes, and their question text is kept.

### Emergency controls

| Control | Effect |
| --- | --- |
| Pause submissions | New submissions are refused |
| Resume submissions | Submissions accepted again |
| Clear current display | Same as **Remove** on the displayed question: presentation shows the idle screen |

"Clear screen" is set apart from the routine pause/resume control and styled with less weight, so it is not hit by accident. There is no "End event" action: it was removed after it was triggered by accident in production. To stop questions at the end, use Pause.

---

## 6. Host Workflow

The host interface is deliberately minimal:

```text
Current question

[ Reject ] [ Approve ]
```

The host sees one `MODERATOR_APPROVED` question at a time: the first in the moderator's "Waiting for host" order (oldest first unless the moderator reordered it).

The host does **not** see:

- The full queue or other questions
- Moderation controls
- Presentation controls
- Event management controls

**Why:** the host needs to listen to speakers, follow the discussion, keep eye contact, manage transitions and read questions. The moderator handles system operation.

---

## 7. Presentation Screen

Dedicated full-screen route: `/presentation`

**Shows:**

- The currently displayed question (and category / display name if provided)
- Event branding and club logo
- Minecraft-inspired visual design

**No controls** are visible, apart from a small back-arrow button (top left) that returns to the question form. It fades out with the mouse cursor after 2.5 s without movement, so it disappears on the projector; on phones it stays visible. When the moderator clicks **Display**, the screen updates in real time.

### Idle screen

When no question is `DISPLAYED`, the presentation shows the **event logo and event name**. This happens:

- At startup, before anything is displayed
- After a question is removed or answered
- After the display is cleared

---

## 8. Spam Protection & Validation

There are no participant accounts. Protection relies on:

- Anonymous browser/session ID (secure, HTTP-only cookie)
- Session-level rate limiting
- IP-level rate limiting
- Server-side validation

### Limits

| Scope | Limit | Where |
| --- | --- | --- |
| Per session | 1 question per 12 seconds | Checked against the `questions` table, so it survives restarts |
| Per session | Max 5 questions per 30 minutes | Same |
| Per IP | 60 `POST /questions` per minute | In-memory throttler (tune on rehearsal) |
| Per IP | 10 `POST /auth/login` per minute | In-memory throttler |

All values live in `backend/src/common/constants.ts`. Rate-limited submissions get `429` with a `retryAfterSeconds` field.

Never ban by IP alone: many university users share the same public IP through NAT. The IP limit must be generous enough not to block a whole campus network.

### Validation

| Field | Rule |
| --- | --- |
| `content` | Required, not blank: 1–500 characters after trimming |
| `displayName` | Optional, max 50 characters |
| `category` | Must be an active category (allowlist) |
| Unknown fields | Rejected |

Escape all user content before rendering. Never render it as raw HTML.

---

## 9. Authentication & Authorization

Only internal users have accounts: `MODERATOR` and `HOST`. Participants never authenticate.

- Passwords hashed with Argon2id
- A JWT (12 h) stored in an HTTP-only cookie (`mt_auth`): `Secure; SameSite=None` in production, since Vercel and Render are different sites. The guard also accepts `Authorization: Bearer` as a fallback (see [Open questions](#open-questions)).
- The user and role are re-read from the database on every request, so deleting an account revokes access immediately
- HTTPS everywhere
- Socket connections are authenticated in a Socket.IO middleware with the same cookie

Hiding a button in the frontend is **not** authorization. For every protected request, the backend checks:

1. Who is this user?
2. What role do they have?
3. Is this state transition allowed from the question's current state?

---

## 10. Architecture

```text
                         Participants
                              |
                            HTTPS
                              |
                              v
                 +-------------------------+
                 |         Vercel          |
                 |        Next.js          |
                 |                         |
                 |  Participant UI         |
                 |  Moderator UI           |
                 |  Host UI                |
                 |  Presentation UI        |
                 +------------+------------+
                              |
                         HTTPS / WSS
                              |
                              v
                 +-------------------------+
                 |         Render          |
                 |         NestJS          |
                 |                         |
                 |  REST API               |
                 |  Socket.IO              |
                 |  Authentication         |
                 |  Authorization          |
                 |  Rate Limiting          |
                 +------------+------------+
                              |
                              v
                 +-------------------------+
                 |       PostgreSQL        |
                 |                         |
                 |   Source of Truth       |
                 |   Users                 |
                 |   Categories            |
                 |   Questions             |
                 |   Event State           |
                 +-------------------------+
```

### Core rule

**PostgreSQL is the source of truth.** WebSockets only deliver changes in real time. In-memory arrays are never authoritative application state.

---

## 11. Technology Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js, React, TypeScript — deployed on Vercel |
| Backend | NestJS, TypeScript, Socket.IO — deployed on Render |
| Database | PostgreSQL |
| ORM | Prisma (or equivalent) |
| Auth | Custom internal accounts |
| Realtime | Socket.IO over WebSockets |
| Design | Minecraft-inspired, pixel/block UI, club logo, event marketing assets |

### Out of scope

This is a single-event application on a single backend instance. Do not add:

- Redis, Kafka, RabbitMQ
- Kubernetes, microservices, multiple backend instances
- Complex event streaming
- A multi-event abstraction

---

## 12. Realtime

Participants do **not** use WebSockets; they only call REST.

Persistent Socket.IO connections are used by the moderator, host and presentation, each joining a room:

| Room | Who |
| --- | --- |
| `moderator` | Moderator dashboard |
| `host` | Host interface |
| `presentation` | Presentation screen |

The server assigns `moderator` or `host` from the authenticated user's role. The presentation screen is public and read-only: it asks for the `presentation` room in the handshake (`auth: { room: "presentation" }`) and only ever receives questions already on screen.

### Flows

Every flow writes to PostgreSQL first, then emits.

```text
Participant submits:  POST /questions → DB (PENDING)            → QUESTION_CREATED       → moderator
Moderator approves:   PATCH approve   → DB (MODERATOR_APPROVED) → QUESTION_READY_FOR_HOST → host
Host approves:        PATCH approve   → DB (HOST_APPROVED)      → QUESTION_HOST_APPROVED  → moderator
Moderator displays:   PATCH display   → DB (DISPLAYED)          → QUESTION_DISPLAYED      → presentation, moderator
Moderator removes:    PATCH remove    → DB (HOST_APPROVED)      → QUESTION_REMOVED        → presentation (idle), moderator
Moderator answers:    PATCH answer    → DB (ANSWERED)           → QUESTION_ANSWERED       → presentation (idle), moderator
```

If **Display** auto-answers the previous question, emit `QUESTION_ANSWERED` for the old one before `QUESTION_DISPLAYED` for the new one.

### Socket events

```text
QUESTION_CREATED

QUESTION_MODERATOR_APPROVED
QUESTION_MODERATOR_REJECTED

QUESTION_READY_FOR_HOST

QUESTION_HOST_APPROVED
QUESTION_HOST_REJECTED

QUESTION_DISPLAYED
QUESTION_REMOVED
QUESTION_ANSWERED
QUESTION_REORDERED
CATEGORIES_UPDATED

SUBMISSIONS_PAUSED
SUBMISSIONS_RESUMED
```

### Reconnection strategy

Socket.IO reconnects automatically, but never assume every event was received.

```text
Socket reconnects
        ↓
Authenticate socket
        ↓
Fetch current state over REST
        ↓
Replace UI state
```

Example: the host disconnects, the moderator approves a question, PostgreSQL stores it, the host reconnects, fetches current state and sees the question.

---

## 13. REST API

### Public

```http
POST /questions
GET  /categories
GET  /event/status
```

### Authentication

```http
POST /auth/login
POST /auth/logout
GET  /auth/me
```

### Moderator

```http
GET    /moderator/questions

PATCH  /moderator/questions/:id/approve
PATCH  /moderator/questions/:id/reject
PATCH  /moderator/questions/:id/display
PATCH  /moderator/questions/:id/remove
PATCH  /moderator/questions/:id/answer
PATCH  /moderator/questions/:id/rollback
PATCH  /moderator/questions/reorder        { "ids": ["…", "…"] }

GET    /moderator/categories               all topics, hidden ones included, with questionCount
POST   /moderator/categories               { "name": "…" }
PATCH  /moderator/categories/:id           { "name"?: "…", "isActive"?: true|false }
DELETE /moderator/categories/:id           204, or 409 if the topic has questions

PATCH  /moderator/event/pause
PATCH  /moderator/event/resume

GET    /moderator/event/status
```

`PATCH /moderator/questions/reorder` takes question ids from one list (`PENDING`, `MODERATOR_APPROVED` or `HOST_APPROVED`) in their new order. The questions swap the positions they already hold, so questions not in the request (hidden by a category filter, or arriving meanwhile) keep their place. A question entering a list gets the current time as its position, so it lands at the end. Mixed lists return `409`, unknown ids `404`. Emits `QUESTION_REORDERED` to the moderator room (and the host room for the host queue).

`GET /moderator/questions` returns the pending, waiting-for-host, host-approved, displayed and previous (last answered) questions plus `stats` (answered and rejected counts), so one call rebuilds the whole dashboard after a reconnect. "Clear current display" calls `remove` on the displayed question; it doesn't need its own endpoint.

### Host

```http
GET   /host/question
PATCH /host/questions/:id/approve
PATCH /host/questions/:id/reject
```

`GET /host/question` returns only the oldest `MODERATOR_APPROVED` question (or `null`), never the queue.

### Presentation

```http
GET /presentation/current
```

Public. Returns the `DISPLAYED` question (content, display name, category) or `null`. Used on (re)connect.

### Health

```http
GET /health
```

---

## 14. Database Design

### User

| Column | Notes |
| --- | --- |
| `id` | |
| `username` | unique |
| `password_hash` | Argon2id / bcrypt |
| `role` | `MODERATOR` \| `HOST` |
| `created_at` | |
| `updated_at` | |

### Category

| Column | Notes |
| --- | --- |
| `id` | |
| `name` | |
| `slug` | unique |
| `display_order` | |
| `is_active` | |
| `created_at` | |

### Question

| Column | Notes |
| --- | --- |
| `id` | |
| `category_id` | FK → Category |
| `content` | 1–500 chars |
| `display_name` | nullable, max 50 chars |
| `participant_session_id` | anonymous session ID |
| `source` | `PRE_EVENT` \| `LIVE`: set at creation by comparing `created_at` with `EVENT_STARTS_AT`. Informational only; it doesn't change the workflow |
| `status` | see [States](#states) |
| `position` | order within the current list (lower = first) |
| `created_at` | |
| `moderator_approved_at` | nullable |
| `moderator_rejected_at` | nullable |
| `host_approved_at` | nullable |
| `host_rejected_at` | nullable |
| `displayed_at` | nullable |
| `answered_at` | nullable |
| `updated_at` | |

### Event state

A single-row table holding global event state (proposed):

| Column | Notes |
| --- | --- |
| `id` | always 1 |
| `submissions_open` | boolean, toggled by pause/resume |
| `updated_at` | |

---

## 15. Frontend

### Routes

| Route | Purpose |
| --- | --- |
| `/` | Participant submission page |
| `/login` | Internal login (moderator, host) |
| `/moderator` | Moderator dashboard |
| `/host` | Host interface |
| `/presentation` | Full-screen presentation |

### Next.js structure

```text
app/
├── page.tsx
├── login/page.tsx
├── moderator/page.tsx
├── host/page.tsx
└── presentation/page.tsx

components/
├── participant/
├── moderator/
├── host/
├── presentation/
└── ui/

lib/
├── api/
├── socket/
├── auth/
└── validation/

hooks/
├── useSocket.ts
├── useAuth.ts
└── useQuestions.ts
```

---

## 16. Backend

### NestJS structure

```text
src/
├── auth/                  login/logout/me, JWT, argon2
├── questions/
│   ├── dto/
│   ├── questions.controller.ts    POST /questions (participant)
│   ├── moderator.controller.ts    /moderator/* (questions + event controls)
│   ├── host.controller.ts         /host/*
│   ├── presentation.controller.ts GET /presentation/current
│   ├── questions.service.ts       the state machine + rate limits
│   ├── question.views.ts          what each role may see
│   └── questions.module.ts
├── realtime/              Socket.IO gateway, rooms, event names
├── categories/
├── event/                 single-row event state (pause/resume/end)
├── users/
├── health/
├── prisma/
├── config/                env validation
├── common/
│   ├── guards/
│   ├── decorators/
│   └── utils/
├── generated/prisma/      generated client (git-ignored)
├── app.setup.ts           shared by main.ts and the e2e tests
└── main.ts
```

The gateway lives in its own `realtime/` module (instead of `questions.gateway.ts`) because both `questions/` and `event/` emit events, and a shared module avoids a circular dependency.

---

## 17. Deployment

### Render (backend)

- Runtime: Node (Web Service)
- Root directory: `backend` (a ready-made Blueprint is in `render.yaml`)
- Build: `npm ci --include=dev && npm run build`. `--include=dev` is needed because `NODE_ENV=production` would otherwise skip the Nest CLI.
- Start: `npm run start:prod` (runs `prisma migrate deploy`, then the server)
- Listen on `process.env.PORT` and host `0.0.0.0`
- Health check: `GET /health`
- Implement graceful shutdown

Render can still restart the service (deployments, maintenance, instance replacement). The app must never depend on a WebSocket connection being permanent.

### Backend environment variables

```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://...
JWT_SECRET=...
CORS_ORIGIN=https://your-vercel-app.vercel.app
EVENT_STARTS_AT=2026-11-15T14:00:00+01:00
```

CORS must allow the actual Vercel origin. Never use `*` for authenticated production requests.

### Vercel (frontend) environment variables

```env
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_WS_URL=wss://your-render-service.onrender.com
NEXT_PUBLIC_EVENT_NAME=MineTech
```

The idle presentation screen shows the site's own address ("Ask your questions at …"), read from the browser at runtime, so no URL needs configuring. Vercel project root directory: `frontend`.

Only `NEXT_PUBLIC_` variables reach the browser. Never put secrets there.

---

## 18. Failure Scenarios

| Scenario | Expected behavior |
| --- | --- |
| Render restarts | NestJS starts → clients reconnect → fetch current state → continue |
| Host disconnects | Moderator keeps operating; host reconnects and syncs |
| Presentation disconnects | Reconnects and fetches the current displayed question |
| Database unavailable | Return a server error. Never show "Question submitted successfully" if the write failed |
| WebSocket unavailable | Automatic reconnect plus REST state refresh |

---

## 19. Development Order

1. **Backend foundation** — NestJS, PostgreSQL, Prisma, authentication, question model, categories, event state
2. **Participant flow** — category selection, submission, anonymous session, validation, rate limiting
3. **Moderator flow** — login, pending list, approve/reject, display, answer/remove, pause/resume
4. **Host flow** — login, receive approved question, approve/reject
5. **WebSockets** — gateway, rooms, events, reconnection, state sync
6. **Presentation** — full-screen question, realtime updates, branding
7. **Design** — Minecraft-inspired UI, club logo, marketing assets, animations
8. **Production** — Vercel, Render, PostgreSQL, env vars, HTTPS/WSS, full rehearsal

---

## 20. Acceptance Criteria

### Main flow

1. Student opens the public page
2. Selects a category
3. Submits an anonymous question
4. Moderator sees it instantly
5. Moderator approves
6. Host sees only that question
7. Host approves
8. Moderator sees it as ready
9. Moderator clicks Display
10. Presentation updates instantly
11. Moderator marks it answered
12. Question leaves the active workflow

### Security and behavior

- Moderator rejection never reaches the host
- Host rejection never reaches the presentation
- Excessive submissions are rate limited
- Invalid categories are rejected
- Invalid question lengths are rejected
- Unauthorized users cannot perform moderator or host actions
- WebSocket interruptions recover through reconnect
- The database remains the source of truth

---

## 21. Event-Day Checklist

### Participant
- [ ] Submit question
- [ ] Category selection
- [ ] Anonymous submission
- [ ] Rate limiting
- [ ] Mobile UI

### Moderator
- [ ] Login
- [ ] Receive questions instantly
- [ ] Approve
- [ ] Reject
- [ ] Display
- [ ] Remove
- [ ] Answer
- [ ] Pause submissions
- [ ] Resume submissions

### Host
- [ ] Login
- [ ] Receive questions
- [ ] Approve
- [ ] Reject

### Presentation
- [ ] Fullscreen
- [ ] Projector tested
- [ ] Question updates instantly
- [ ] Reconnect tested

### Infrastructure
- [ ] PostgreSQL working
- [ ] Render backend working
- [ ] Vercel frontend working
- [ ] WebSocket reconnect tested
- [ ] Backend restart tested
- [ ] Database failure behavior tested
- [ ] HTTPS/WSS verified

### Backup
- [ ] Backup moderator credentials
- [ ] Backup host credentials
- [ ] Emergency manual workflow

---

## Open Questions

Decisions the spec does not settle yet:

1. **Auth transport** — implemented as a JWT in an HTTP-only `SameSite=None; Secure` cookie. Browsers that block third-party cookies (Safari by default, Chrome in some modes) may drop it because Vercel and Render are different sites. The fix is a shared custom domain (e.g. `qa.club.tld` + `api.club.tld`), or switching to the Bearer header the guard already accepts. **Test the moderator and host devices during rehearsal.**
