# todo-app

A warm, restrained single-user todo app. Full stack — Next.js client + dumb proxy,
Gin/Go REST API, PostgreSQL — running from **one command**.

## Quick start (≤10 minutes, zero manual setup)

**Prerequisite:** Docker with Compose v2 (`docker compose version`).

```bash
git clone <this-repo> && cd todo-app
docker compose up
```

Then open **http://localhost:3000**. You'll see the empty state ("Nothing here yet").

That's it — no database to create, no migrations to run by hand, no `.env` to write.
The stack comes up healthcheck-gated: **db** (healthy) → **backend** (applies
migrations, then serves) → **frontend**. Only `frontend` is exposed to your machine;
`backend` and `db` are internal to the compose network.

To stop: `Ctrl-C`, then `docker compose down`. Your todos persist in a named volume
and reappear on the next `docker compose up`.

## Architecture at a glance

| Service | Tech | Exposed? | Role |
| --- | --- | --- | --- |
| `frontend` | Next.js 16.2 (React 19) + TanStack Query 5 | **:3000 (host)** | UI + dumb BFF proxy — no business logic |
| `backend` | Go 1.26 + Gin 1.12 | internal only | layered `handler → service → repository`; owns all rules |
| `db`  | PostgreSQL 18 | internal only | reached only via the repository |

- The browser calls **same-origin** `/api/*`; `frontend` forwards verbatim to `backend` (AD-3).
- The `frontend ↔ backend` wire contract is defined once in [`shared/todo.ts`](shared/todo.ts) (AD-6).
- Schema evolves only through versioned `golang-migrate` files in `backend/migrations/`,
  embedded in the binary and applied on boot (AD-11).

Full rationale lives in
[`_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md`](_bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md)
(decisions AD-1 … AD-12). _Note: the architecture spine still names the units `web`/`api`;
the directories/services were renamed to `frontend`/`backend` — the spine should be
updated to match on its next revision._

## Configuration

All config is 12-factor env with working defaults baked into `docker-compose.yml`.
Copy `.env.example` to `.env` only to override (e.g. `WEB_PORT`). No secrets are
committed; `.env` is gitignored.

## Project layout

```text
frontend/       Next.js client + dumb proxy (app/, lib/)
backend/        Go service: handler/ service/ repository/ migrations/ testhelpers/
shared/         single source-of-truth wire contract (todo.ts)
docker-compose.yml
.env.example
```

## Development & tests

The stack is designed to run in Docker; you don't need Go or Postgres installed
locally. To work on a unit in isolation:

**frontend** (Node 20+):

```bash
cd frontend
npm install
npm run lint          # eslint
npm run format:check  # prettier
npm run test:unit     # vitest + React Testing Library
npm run build         # production build
```

**backend** (Go 1.26+, or via Docker):

```bash
cd backend
go vet ./...
go test ./...                     # unit tests (no DB needed)
go build -tags testseed ./...     # compiles the test-only seed/reset seam [TC1]
```

The production `backend` image is built **without** the `testseed` tag, so the
seed/reset helper in `backend/testhelpers/` is never reachable in a deployed build.

The full Playwright / Vitest / Go integration suite is scaffolded as a drop-in under
`_bmad-output/test-artifacts/framework-design/` and is installed in a later story.

## Health & readiness

`GET /health` on `backend` reports migrated + serving; the compose `backend`
healthcheck (and CI E2E gating) wait on it.
