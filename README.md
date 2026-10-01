# MineTech

A live Q&A platform for the club's university tech event. Students send questions from their phones before or during the talks. A moderator filters them, the host approves them, and the chosen question appears on the projector in real time.

> **Status:** early development. The specification is complete, and the code is not written yet.

## How it works

```text
Student submits ──► Moderator approves ──► Host approves ──► Moderator displays ──► Projector
                         │                      │
                         ▼                      ▼
                      Rejected               Rejected
```

- **Students** pick a category, type a question, and submit, anonymously by default. They never see other questions.
- **The moderator** runs the event: reviews incoming questions, chooses what goes on screen, and can pause submissions or end the event.
- **The host** sees one question at a time with two buttons: Approve or Reject. Nothing else, so they can stay focused on the speakers.
- **The presentation screen** (`/presentation`) shows the current question full-screen, or the event logo when nothing is displayed.

## Tech stack

| Part | Technology | Hosting |
| --- | --- | --- |
| Frontend | Next.js, React, TypeScript | Vercel |
| Backend | NestJS, TypeScript, Socket.IO | Render |
| Database | PostgreSQL (via Prisma) | — |

PostgreSQL holds all state. Socket.IO only pushes updates to the moderator, host, and presentation screens, and every screen re-syncs from the database after a reconnect.

## Repository layout

```text
frontend/   Next.js app: participant, login, moderator, host, presentation pages
backend/    NestJS API: REST, Socket.IO, auth, rate limiting
docs/       Project specification
```

`frontend/` and `backend/` will be added as development starts.

## Pages

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | Students | Submit a question |
| `/login` | Moderator, host | Sign in |
| `/moderator` | Moderator | Dashboard and event controls |
| `/host` | Host | Approve or reject the current question |
| `/presentation` | Projector | Full-screen question display |

## Configuration

**Backend** (Render):

```env
NODE_ENV=production
PORT=10000
DATABASE_URL=postgresql://...
JWT_SECRET=...
CORS_ORIGIN=https://your-vercel-app.vercel.app
EVENT_STARTS_AT=2026-11-15T14:00:00+01:00
```

**Frontend** (Vercel):

```env
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_WS_URL=wss://your-render-service.onrender.com
```

Never put secrets in `NEXT_PUBLIC_*` variables. They are visible in the browser.

## Getting started

Setup instructions will be added once the apps are set up. Prerequisites:

- Node.js (LTS)
- PostgreSQL

## Documentation

- [docs/SPEC.md](docs/SPEC.md): full specification, covering the question workflow, API, database, realtime events, security, deployment, and the event-day checklist
- [CLAUDE.md](CLAUDE.md): guidelines for AI-assisted development in this repo
