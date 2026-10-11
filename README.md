# MineTech

A live Q&A platform for the club's university tech event. Students send questions from their phones before or during the talks. A moderator filters them, the host approves them, and the chosen question appears on the projector in real time.

> **Status:** feature-complete for the first event. Backend and frontend are built and tested; next steps are deployment and a full rehearsal (see the event-day checklist in [docs/SPEC.md](docs/SPEC.md#21-event-day-checklist)).

## How it works

```text
Student submits ──► Moderator approves ──► Host approves ──► Moderator displays ──► Projector
                         │                      │
                         ▼                      ▼
                      Rejected               Rejected
```

- **Students** pick a category, type a question, and submit, anonymously by default. They never see other questions.
- **The moderator** runs the event: reviews incoming questions, chooses what goes on screen (even before the host has reviewed it), can roll back to the previous question, and can pause submissions or end the event.
- **The host** sees one question at a time with two buttons: Approve or Reject. Nothing else, so they can stay focused on the speakers.
- **The presentation screen** (`/presentation`) shows the current question full-screen, or the event logo when nothing is displayed.

## Tech stack

| Part | Technology | Hosting |
| --- | --- | --- |
| Frontend | Next.js 16, React 19, TypeScript | Vercel |
| Backend | NestJS 12, TypeScript, Socket.IO | Render |
| Database | PostgreSQL 17 (via Prisma 7) | Any managed PostgreSQL |

PostgreSQL holds all state. Socket.IO only pushes updates to the moderator, host, and presentation screens, and every screen re-syncs from the database after a reconnect.

## Repository layout

```text
frontend/            Next.js app: participant, login, moderator, host, presentation pages
backend/             NestJS API: REST, Socket.IO, auth, rate limiting, Prisma schema
docker-compose.yml   Local PostgreSQL for development and tests
render.yaml          Render Blueprint for the backend
docs/                Project specification
```

## Pages

| Route | Who | Purpose |
| --- | --- | --- |
| `/` | Students | Submit a question |
| `/login` | Moderator, host | Sign in |
| `/moderator` | Moderator | Dashboard and event controls |
| `/host` | Host | Approve or reject the current question |
| `/presentation` | Projector | Full-screen question display |

## Getting started

Prerequisites: Node.js 22+ and Docker (for the local database).

```bash
# 1. Database (PostgreSQL on localhost:5433, plus a separate test database)
docker compose up -d

# 2. Backend → http://localhost:4000
cd backend
cp .env.example .env        # then set JWT_SECRET and the SEED_* passwords
npm install
npx prisma migrate deploy
npm run db:seed             # moderator/host accounts from SEED_*
npm run start:dev

# 3. Frontend → http://localhost:3000 (in another terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Then open:

- http://localhost:3000: participant page (try it with your phone's screen size)
- http://localhost:3000/login: sign in with the `SEED_MODERATOR_*` or `SEED_HOST_*` credentials
- http://localhost:3000/presentation: projector view (double-click or press **F** for fullscreen)

Add or reset an account at any time (e.g. backup credentials for event day):

```bash
cd backend && npm run user:create -- backup-mod MODERATOR
```

## Tests

```bash
cd backend
npm run lint
npm test            # unit tests
npm run test:e2e    # full workflow + security, against the Docker test database

cd frontend
npm run lint && npm run typecheck && npm run build
```

The backend e2e suite drives the real API and real Socket.IO clients through every acceptance criterion in the spec: the main flow, rejections never leaking to the host or projector, rate limits, validation, role checks, pause/resume/end, skipping the host, rolling back, and concurrent clicks.

## Deployment

**Backend on Render.** Create a PostgreSQL database, then a Blueprint from `render.yaml` (or a Web Service with root directory `backend`, build `npm ci --include=dev && npm run build`, start `npm run start:prod`, health check `/health`). Migrations run automatically on start. Seed once from your machine, passing real passwords inline so the dev ones in `.env` aren't used:

```bash
cd backend
DATABASE_URL='<render external db url>' SEED_MODERATOR_PASSWORD='…' SEED_HOST_PASSWORD='…' npm run db:seed
```

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=...                      # long random string
CORS_ORIGIN=https://your-vercel-app.vercel.app
EVENT_STARTS_AT=2026-11-15T14:00:00+01:00
```

**Frontend on Vercel.** Import the repo with root directory `frontend`.

```env
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_WS_URL=wss://your-render-service.onrender.com
NEXT_PUBLIC_EVENT_NAME=MineTech
```

Never put secrets in `NEXT_PUBLIC_*` variables. They are visible in the browser.

> **Rehearse on the real devices.** Login uses a cookie set by the Render domain. Browsers that block third-party cookies (Safari by default) can refuse it. If moderator or host login loops back to `/login`, put both apps on one custom domain (e.g. `qa.club.tld` and `api.club.tld`). See the open question in the spec.

## Branding

The MineTech wordmark is `frontend/public/MineTechLogo.svg` (headers and projector). The square grass block, `frontend/public/logo.svg` and `frontend/app/icon.svg`, is used for the browser tab icon and small square spots. Headings use the Minecraft Ten font from `frontend/public/fonts/minecraft-ten.ttf` ("Freeware, Non-Commercial", from FontSpace). That folder is git-ignored, so a deploy from git falls back to Press Start 2P; to use Minecraft Ten in production, remove `frontend/public/fonts/` from `.gitignore` and commit the file, if its license fits your use. The club's logo (`frontend/public/GDGC-White.svg`, white version for the dark theme) sits under the MineTech logo on the home page and on the projector's idle screen; `GDGC-Black.svg` and `GDGC-Brackets.svg` are spare variants. The event name comes from `NEXT_PUBLIC_EVENT_NAME`. The projector's idle screen shows the site's own address ("Ask your questions at …"), so it is always correct for whatever domain you deploy to.

## Documentation

- [docs/SPEC.md](docs/SPEC.md): full specification, covering the question workflow, API, database, realtime events, security, deployment, and the event-day checklist
- [CLAUDE.md](CLAUDE.md): guidelines for AI-assisted development in this repo
