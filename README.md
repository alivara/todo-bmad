# todo-app

[![CI](https://github.com/alivara/todo-bmad/actions/workflows/ci.yml/badge.svg)](https://github.com/alivara/todo-bmad/actions/workflows/ci.yml)

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
The stack comes up healthcheck-gated: **db** (healthy) → **api** (applies migrations,
then serves) → **web**. Only `web` is exposed to your machine; `api` and `db` are
internal to the compose network.

To stop: `Ctrl-C`, then `docker compose down`. Your todos persist in a named volume
and reappear on the next `docker compose up`.

## Architecture at a glance

| Service | Tech | Exposed? | Role |
| --- | --- | --- | --- |
| `web` | Next.js 16.2 (React 19) + TanStack Query 5 | **:3000 (host)** | UI + dumb BFF proxy — no business logic |
| `api` | Go 1.26 + Gin 1.12 | internal only | layered `handler → service → repository`; owns all rules |
| `db`  | PostgreSQL 18 | internal only | reached only via the repository |

- The browser calls **same-origin** `/api/*`; `web` forwards verbatim to `api` (AD-3).
- The `web ↔ api` wire contract is defined once in [`shared/todo.ts`](shared/todo.ts) (AD-6).
- Schema evolves only through versioned `golang-migrate` files in `api/migrations/`,
  embedded in the binary and applied on boot (AD-11).

Full rationale lives in
[`_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md`](_bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md)
(decisions AD-1 … AD-12).

## Configuration

All config is 12-factor env with working defaults baked into `docker-compose.yml`.
Copy `.env.example` to `.env` only to override (e.g. `WEB_PORT`). No secrets are
committed; `.env` is gitignored.

## Project layout

```text
web/            Next.js client + dumb proxy (app/, lib/)
api/            Go service: handler/ service/ repository/ migrations/ testhelpers/
shared/         single source-of-truth wire contract (todo.ts)
docker-compose.yml
.env.example
```

## Development & tests

The stack is designed to run in Docker; you don't need Go or Postgres installed
locally. To work on a unit in isolation:

**web** (Node 20+):

```bash
cd web
npm install
npm run lint          # eslint
npm run format:check  # prettier
npm run test:unit     # vitest + React Testing Library
npm run build         # production build
```

**api** (Go 1.26+, or via Docker):

```bash
cd api
go vet ./...
go test ./...                     # unit tests (no DB needed)
go build -tags testseed ./...     # compiles the test-only seed/reset seam [TC1]
```

The production `api` image is built **without** the `testseed` tag, so the seed/reset
helper in `api/testhelpers/` is never reachable in a deployed build.

The full Playwright / Vitest / Go integration suite runs both locally and in CI:
Vitest and Playwright live under `web/`, and the Go `testseed` integration suite runs
against the Dockerized stack. See [Continuous Integration](#continuous-integration) for
the exact commands CI invokes and how to reproduce them locally.

## Continuous Integration

CI runs on **every pull request** and **every push to `main`** (see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml)). Three jobs run in parallel:

- **`web (lint / format / unit)`** — the fast lane for the client:
  `npm run lint` (eslint), `npm run format:check` (prettier), `npm run test:unit` (Vitest).
- **`api (gofmt / golangci-lint / go test)`** — the fast lane for the service:
  a `gofmt` diff check (`gofmt -l .` must be empty), `golangci-lint run ./...`, and
  `go test ./...` (which also writes a Go test-results summary to the run).
- **`integration-e2e (dockerized stack)`** — brings the full stack up with the test compose
  override (`docker compose -f docker-compose.yml -f docker-compose.test.yml up --build`, which
  builds `api` with the `testseed` tag), health-gates on `GET /api/health`, then runs the Go
  `testseed` integration suite and the full Playwright suite (`npm run test:e2e`). On failure it
  uploads the Playwright report and compose logs; it always tears the stack down afterwards.

### Run the same checks locally

These are the same checks CI invokes, from a clean checkout. CI runs on Node 22 and Go 1.26;
the E2E path additionally needs the Playwright browsers and a `golangci-lint` matching CI (both
noted below) — no other setup.

**web** (Node 20+, CI uses Node 22):

```bash
cd web
npm ci                # CI uses `npm ci` (lockfile-exact); `npm install` also works
npm run lint          # eslint
npm run format:check  # prettier
npm run test:unit     # vitest
```

**api** (Go 1.26+, or via Docker):

```bash
cd api
gofmt -l .            # must print nothing
golangci-lint run ./...   # v2.12.2 — see note below
go test ./...             # unit tests, no DB
```

> **golangci-lint:** CI builds **v2.12.2 from source** with the Go 1.26 toolchain
> (`install-mode: goinstall`) because prebuilt release binaries currently lag Go 1.26 and
> refuse to lint a `go 1.26` module. Match it locally with
> `go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2`.

**full stack + integration + E2E** (Docker with Compose v2):

```bash
# from the repo root — bring up the test-override stack and wait until healthy
docker compose -p todoci -f docker-compose.yml -f docker-compose.test.yml up --build -d --wait --wait-timeout 240

# api integration suite: the Go `testseed` tests against the live db, on the compose network
docker run --rm --network todoci_default -v "$PWD/api":/app -w /app \
  -e "DATABASE_URL=postgres://todo:todo@db:5432/todo?sslmode=disable" \
  golang:1.26-alpine go test -tags testseed ./...

# Playwright E2E against the running stack (first run installs the browsers, as CI does)
cd web && npx playwright install --with-deps chromium webkit && npm run test:e2e

# tear down (and drop the volume) when done
docker compose -p todoci -f docker-compose.yml -f docker-compose.test.yml down -v
```

### Merge protection

Merging into `main` requires a pull request whose three CI checks are all green. The
required checks are:

- `web (lint / format / unit)`
- `api (gofmt / golangci-lint / go test)`
- `integration-e2e (dockerized stack)`

Maintainers enable this in **GitHub → Settings → Branches**: protect `main`, require a
pull request before merging, and require those three status checks to pass. (It can also
be applied via `gh api` against the branch-protection endpoint.)

## Health & readiness

`GET /health` on `api` reports migrated + serving; the compose `api` healthcheck (and
CI E2E gating) wait on it.
