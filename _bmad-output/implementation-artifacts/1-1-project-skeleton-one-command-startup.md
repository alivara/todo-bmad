---
baseline_commit: f592d1ef73221ed574f3059a33e46438b6896825
---

# Story 1.1: Project skeleton & one-command startup

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a reviewer/developer,
I want to clone the repo and bring the whole stack up with one command,
so that I can run and evaluate the app in minutes with no manual setup.

## Acceptance Criteria

> Lifted verbatim from `epics.md` Story 1.1, augmented with the non-negotiable P0 test enablers the risk review pinned to this story (health route [TC5], seed/reset seam [TC1], durability [R6], migration-on-boot [R7], readiness [R10]). ACs 1–6 are the epic contract; ACs 7–9 are the test-design gate for Epic 1's "done."

**AC1 — Healthcheck-gated one-command startup**
**Given** a clean clone
**When** I run `docker compose up`
**Then** `web`, `api`, and `db` all start healthcheck-gated (`db` healthy → `api` migrates then serves → `web`)
**And** only `web` exposes a host port (`api`/`db` internal-only), and `db` uses a named volume.

**AC2 — Same-origin empty list through the dumb proxy**
**Given** the stack is up
**When** the browser loads `web`
**Then** it calls `GET /api/todos` same-origin, the dumb proxy forwards to `api` verbatim, and `api` returns a bare `[]` (never `null`)
**And** the UI renders the bare empty state ("Nothing here yet") — never a blank screen.

**AC3 — Migrations-on-boot create the schema**
**Given** the `api` boots
**When** it starts
**Then** versioned `golang-migrate` migrations run automatically before it serves
**And** create the `todos` table (`id` uuid PK, `title` text, `description` text, `status` text + `CHECK (status IN ('active','completed'))`, `created_at`/`updated_at` timestamptz).

**AC4 — ≤10-minute reproducible setup + committed quality gate**
**Given** the repo
**When** a new developer follows the README
**Then** clone→install→run completes in ≤10 minutes with no undocumented steps
**And** `.env.example` documents all config with working defaults, no secrets are committed, and lint/format configs (`eslint`+`prettier` in `web`, `gofmt`+`golangci-lint` in `api`) are committed and pass.

**AC5 — Design tokens as CSS variables (light + warm-dark values), no toggle yet**
**Given** the design system
**When** the app renders
**Then** the Cream & Terracotta token set — light and warm-dark values — is defined as CSS variables from day one (the theme toggle itself is deferred to Epic 3).

**AC6 — Named-volume durability [R6]**
**Given** the stack has been up
**When** I run `docker compose down` then `docker compose up` again
**Then** the `db` named volume re-mounts and any persisted rows survive (a silent empty start is a durability defect, not acceptable).

**AC7 — `/health` readiness route [TC5, R10]**
**Given** the `api`
**When** it has migrated and is serving
**Then** `GET /health` returns a success status reflecting "migrated + serving"
**And** the compose `api` healthcheck and the (future) Playwright `webServer` gate on it.

**AC8 — Test-only seed/reset seam [TC1]**
**Given** the repository layer
**When** the `api` is built under the test profile (`testseed` build tag)
**Then** a parameterized test-only seed/reset path exists (`api/testhelpers/seed.go`) that can set list state and reset between runs
**And** this path is **never reachable in the production build** (build-tag guarded).

**AC9 — GET /todos empty-slice contract [R3 seed]**
**Given** an empty database
**When** `GET /todos` is called
**Then** the handler emits an **empty slice**, serialized as `[]` — never a nil slice serialized as `null`.

## Tasks / Subtasks

- [x] **Task 1 — Monorepo scaffold + repo hygiene** (AC: 4)
  - [x] Create the source tree exactly per Structural Seed: `web/`, `api/{handler,service,repository,migrations,testhelpers}`, `shared/`, top-level `docker-compose.yml`, `.env.example`, `README.md`. (Added `api/model/` and `api/db/` — see Project Structure Notes.)
  - [x] Add `.gitignore` entries for `node_modules/`, Go build output, `.env` (never commit real env).
  - [x] Confirm no secrets are committed anywhere; `.env.example` holds only working non-secret defaults.
- [x] **Task 2 — `db` service + named volume + healthcheck** (AC: 1, 6)
  - [x] Define the `db` PostgreSQL 18 service in `docker-compose.yml`, internal-only (no host port), on the compose network.
  - [x] Attach a **named volume**; verify data survives `down`+`up` (AC6). NOTE: PG18 requires the mount at `/var/lib/postgresql` (not `/var/lib/postgresql/data`) — see Debug Log.
  - [x] Add a `db` healthcheck (`pg_isready`) so `api` can `depends_on: condition: service_healthy`.
- [x] **Task 3 — `api` service: Go + Gin skeleton, layered** (AC: 1, 3, 7, 9)
  - [x] Init Go module (Go 1.26), add Gin 1.12.0, golang-migrate 4.19.1, pgx/v5 driver (chosen per open-Q1; documented in README).
  - [x] Wire `handler → service → repository` layering; **no SQL in handler, no Gin in service** (AD-1).
  - [x] Define the **repository interface** (AD-2) with `ListTodos(ctx)` + `Ping(ctx)` — **no speculative `user_id` param**. Added a Postgres implementation.
  - [x] Implement `GET /todos` → service `ListTodos` → repository `ListTodos`; handler emits an **empty slice** so JSON is `[]` (AC9). Returns AD-6-shaped resources (verified with a real row during the durability check).
  - [x] Implement `GET /health` (AC7) reporting migrated + serving (pings the datastore).
  - [x] Embed `api/migrations/` in the binary; run migrations on startup **before** `router.Run` (AD-11).
  - [x] `api` internal-only (no host port); structured logging (slog JSON) configured.
- [x] **Task 4 — Migration: `todos` table** (AC: 3)
  - [x] Create `api/migrations/000001_create_todos.up.sql` + matching `.down.sql` (golang-migrate up/down pair).
  - [x] Schema: `id uuid PK DEFAULT gen_random_uuid()`, `title text NOT NULL`, `description text NOT NULL DEFAULT ''`, `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed'))`, `created_at`/`updated_at timestamptz NOT NULL DEFAULT now()`. (Verified live via `\d todos`.)
  - [x] Enable `pgcrypto` for `gen_random_uuid()` in the migration.
- [x] **Task 5 — Test-only seed/reset seam** (AC: 8)
  - [x] Create `api/testhelpers/seed.go` guarded by `//go:build testseed`, with `SeedTodos(...)` / `ResetTodos(...)` using **parameterized** SQL through the pool.
  - [x] Confirmed: the production build (no `testseed` tag) does not compile this path in; `go build -tags testseed ./...` compiles it.
- [x] **Task 6 — `web` service: Next.js + dumb proxy + TanStack Query + empty state** (AC: 2, 5)
  - [x] Init Next.js 16.2.10 (React 19), add `@tanstack/react-query` 5.x, `eslint` + `prettier`.
  - [x] Implement the **dumb proxy** (`app/api/[...path]/route.ts`) forwarding `/api/*` to `api` verbatim (AD-3); on unreachable→502 / timeout→504 it synthesizes an AD-9-shaped error — never HTML or a thrown fetch.
  - [x] Set up the TanStack Query client (AD-4) and a `fetchTodos` query hitting **same-origin** `GET /api/todos`.
  - [x] Render the **bare empty state** when the list is `[]` with verbatim microcopy. Never a blank screen (browser-verified). Basic loading indicator ("Getting your tasks…") + basic error+retry; polished versions are Epic 3.
  - [x] `web` is the **only** host-exposed service.
- [x] **Task 7 — Design tokens as CSS variables** (AC: 5)
  - [x] Define **all** Cream & Terracotta tokens as CSS custom properties — light on `:root`, warm-dark under `:root[data-theme="dark"]` (inert; Epic 3 wires the toggle + RD-6). No toggle built.
  - [x] Every token present (all 9 light + 9 `-dark` variants), guarded by `tests/tokens.test.ts`; the empty state + wordmark consume them (browser-verified warm palette live).
- [x] **Task 8 — `shared/` wire-contract seed** (AC: 2, 9)
  - [x] Scaffold `shared/` and define the single source-of-truth `Todo` type per AD-6. `web` derives its query type from it via the `@shared/*` tsconfig alias (`import type`, erased at build).
  - [x] Go mirror lives in `api/model/todo.go` with matching `json` tags; full both-sides enforcement (contract test on drift) is a documented Story 1.2 follow-up (see `shared/README.md`).
- [x] **Task 9 — Compose wiring, env, README, quality-gate pass** (AC: 1, 4)
  - [x] `docker-compose.yml`: three services, healthcheck-gated order (`db` healthy → `api` migrate+serve → `web`), 12-factor env with defaults baked in so bare `docker compose up` works.
  - [x] `.env.example` documents every var. No secrets committed.
  - [x] README: clone → `docker compose up` → open `web`, zero manual steps.
  - [x] Quality gate passes: `eslint`+`prettier` (web), `gofmt`+`go vet`+`golangci-lint` (api). `api/.golangci.yml` added during code review; `golangci-lint v2.12.2` → 0 issues.
- [x] **Task 10 — End-to-end proof** (AC: 1, 2, 3, 6, 7)
  - [x] Cold `docker compose up` → all three healthy **in order** (db→api→web) → browser shows the empty state.
  - [x] `GET /api/todos` returns `200 []` through the proxy; `GET /health` returns `200 {"status":"ok"}`.
  - [x] Durability: inserted a row, `down` (kept volume), `up` → row survived and returned in AD-6 wire shape (AC6).

### Review Findings

_Code review 2026-07-18 (adversarial: Blind Hunter + Edge Case Hunter + Acceptance Auditor). 3 layers, all completed. 8 findings after triage (4 patch, 4 defer); 4 dismissed as false-positive/by-design._

**Patch (all FIXED 2026-07-18):**

- [x] [Review][Patch] Proxy hardening — moved body read inside try (client abort → AD-9 error, not HTML 500); buffer upstream body so the timeout covers headers+body (no more stalled-body hang); expanded hop-by-hop strip set; validated `API_PROXY_TIMEOUT_MS` (NaN/≤0 → 10s default) [web/app/api/[...path]/route.ts]
- [x] [Review][Patch] Startup resilience — added `restart: unless-stopped` to all three services, `start_period` to db/api healthchecks, and `pg_isready -h 127.0.0.1` so db is "healthy" only once the TCP listener accepts (not just the initdb socket) [docker-compose.yml]
- [x] [Review][Patch] AC4 gap — added `api/.golangci.yml` (v2, standard linters); ran `golangci-lint v2.12.2` (go1.26) → **0 issues**. Go quality gate now genuinely satisfied [api/.golangci.yml]
- [x] [Review][Patch] `/health` 503 now returns the AD-9 envelope `{error:{code:"internal_error",message}}` [api/handler/handler.go]

**Deferred (latent for Story 1.1 — the current endpoints never trigger these; revisit when the surface grows):**

- [x] [Review][Defer] Proxy `redirect:'manual'` → opaqueredirect (status 0) throws in `Response` ctor → mis-reported 502; also drops `Location` [web/app/api/[...path]/route.ts:43,50] — deferred: the api issues no 3xx
- [x] [Review][Defer] `fetchTodos` calls `res.json()` unconditionally — a 2xx `204`/empty or non-array body throws/crashes render [web/lib/todos.ts:16] — deferred: `GET /todos` always returns a JSON array
- [x] [Review][Defer] `context.Background()` (no timeout) for Migrate/Connect/Ping; no `http.Server` read/write timeouts [api/main.go, api/db/db.go] — deferred: internal-only service
- [x] [Review][Defer] `HEAD`/`OPTIONS` not routed through the proxy (Next returns 405) [web/app/api/[...path]/route.ts:74] — deferred: not needed in 1.1

**Dismissed (not written as work):** missing `package-lock.json` / `go.sum` (both exist on disk; excluded from the review diff) · `page.tsx` `data.length` "type error" (false — `next build` passes; TanStack v5 narrows the destructured discriminated union) · `sslmode=disable`+default password (by-design for local v1, documented in `.env.example`).

## Dev Notes

### Scope discipline (what this story is and is NOT)
This is the **infra walking-skeleton** — the first of three foundation stories. It must prove `docker compose up` end-to-end and render an honest empty state, nothing more:
- **IN scope:** monorepo scaffold, compose topology, migrations-on-boot, `todos` table, `GET /todos` (empty), `GET /health`, dumb proxy, TanStack Query wiring, bare empty state, design tokens as CSS variables, seed/reset seam, quality gate, README.
- **NOT in scope (later stories):** creating todos / `POST` (Story 1.2), list rendering with real rows / newest-first / relative time (Story 1.3), edit/toggle/delete (Epic 2), the theme *toggle* + polished skeleton/error illustrations + progressive char counter (Epic 3). Build only the *bare* loading/empty/error floor here.
- The **full `shared/` enforcement** (Go + web both deriving from one definition, contract build-error on drift) formally lands with `POST` in Story 1.2 — see Task 8 note.

### Architecture guardrails (binding — from ARCHITECTURE-SPINE.md AD-1…AD-12)
- **AD-1 layering:** HTTP only in `handler/`; rules only in `service/`; all persistence via the `repository/` interface. Never SQL in a handler; never import Gin in a service. [Source: architecture/ARCHITECTURE-SPINE.md#AD-1]
- **AD-2 repository seam:** repository is a Go **interface**; keep it clean today — **no speculative `user_id`/scope param**. Multi-user later = threading owner scope through this one interface. [Source: #AD-2]
- **AD-3 dumb proxy:** browser → same-origin `web` → forwards `/api/*` to `api` verbatim (status + body untouched). No CORS. On unreachable/timeout, synthesize AD-9-shaped `502`/`504`; never leak HTML or a thrown fetch. [Source: #AD-3]
- **AD-4 TanStack Query owns server state:** todos live in the query cache only; no component keeps a private copy. [Source: #AD-4]
- **AD-6 wire contract:** camelCase; timestamps nested under `metadata`; `description` is `""` never `null`; `GET /todos` = bare array, `[]` never `null`. [Source: #AD-6]
- **AD-8 status enum:** Postgres `text` + `CHECK (status IN ('active','completed'))` — **not** a native PG enum type; allowed list kept in exactly two places (DB CHECK + Go service validation). Adding a state edits the list, never `ALTER TYPE`. [Source: #AD-8]
- **AD-9 error contract:** every non-2xx = `{ error: { code, message } }`; code vocabulary `validation_error`(400) · `not_found`(404) · `internal_error`(500; proxy also 502/504). Only the proxy-synthesis path is exercised in this story. [Source: #AD-9]
- **AD-11 migrations:** versioned `golang-migrate` up/down under `api/migrations/`, **embedded in the binary**, applied on startup **before** serving. No `AutoMigrate`, no `init.sql`, no hand-run SQL. [Source: #AD-11]
- **AD-12 deploy envelope:** three compose services; **only `web`** exposes a host port; `api`/`db` internal-only; `db` on a **named volume** (data survives `down`+`up`); healthcheck-gated startup `db`→`api`→`web`; 12-factor env with defaults in compose; `.env.example`; no secrets committed. Readiness at `GET /health`. [Source: #AD-12]

### Wire contract shape (AD-6) — the exact resource
```json
{ "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "active",
  "metadata": { "createdAt": "2026-07-17T14:03:11Z", "updatedAt": "2026-07-17T14:03:11Z" } }
```
- camelCase on the wire (Go `json` tags map PascalCase→camelCase); Postgres columns stay `snake_case`.
- Timestamps **nested under `metadata`** (a common miss — don't put them top-level).
- Timestamps RFC3339 UTC, trailing `Z`, **second precision** (AD-7). Server-authoritative — the client never generates ids/timestamps.
- `GET /todos` empty must serialize as `[]`. In Go: initialize the slice `todos := []Todo{}` (or `make([]Todo, 0)`), never return a nil slice. [Source: #AD-6, epics.md#FR-coverage]

### Source tree to create (exact — from Structural Seed)
```text
todo-app/
  web/            app/ (routes, components, error boundary) · lib/ (query client, api proxy handlers)
  api/            handler/ · service/ · repository/ · migrations/ · testhelpers/ (seed, testseed-tagged)
  shared/         single source-of-truth wire type (AD-6)
  docker-compose.yml   web (exposed) + api + db (internal), healthcheck-gated
  .env.example
  README.md
```
[Source: architecture/ARCHITECTURE-SPINE.md#Structural-Seed]

### Design tokens — exact values (AC5)
Define **all** as CSS variables. Light on `:root`; dark values scoped for later activation (Epic 3 wires the toggle; RD-6 says first-load honors OS `prefers-color-scheme`).

Light: `surface-base #F5EFE6` · `surface-raised #FFFCF7` · `ink-primary #2E2A24` · `ink-secondary #8A8072` · `ink-muted #B8AE9E` · `accent #C15A34` · `accent-soft #E9C9B8` · `border-hairline #E5DBCC` · `on-accent #FFF9F4`

Warm-dark: `surface-base-dark #221E1A` · `surface-raised-dark #2C2722` · `ink-primary-dark #F0E9DE` · `ink-secondary-dark #A69C8C` · `ink-muted-dark #6E655A` · `accent-dark #D97B54` · `accent-soft-dark #4A362B` · `border-hairline-dark #3A332C` · `on-accent-dark #221E1A`

Typography family: `ui-rounded, 'SF Pro Rounded', 'Nunito', 'Quicksand', system-ui, sans-serif`. Empty-state uses `empty-headline` (19px/700) + `description` (14px/400). Spacing scale 4/8/12/16/24/32; radii `sm 10 / md 13 / lg 16 / full 9999`. [Source: ux-designs/DESIGN.md front-matter + Colors/Typography/Shapes]

### Locked microcopy (use verbatim — AC2)
- Empty headline: **"Nothing here yet"**
- Empty subline: **"Add your first task above — it'll show up right here."**
- Wordmark: **"todo"** (lowercase) + terracotta accent dot.
[Source: epics.md#UX-DR15, UX-DR25; DESIGN.md#Empty-state]

### Testing standards summary (P0 enablers this story owns)
- **TC5 / R10 — `/health`:** required now; Playwright `webServer` and CI E2E gate on it later. [Source: test-design/todo-app-handoff.md; framework-design/README.md]
- **TC1 — seed/reset seam:** `api/testhelpers/seed.go`, `testseed` build tag, parameterized SQL, **never prod-reachable**. [Source: framework-design/README.md#Risk-review-wiring]
- **R6 — durability:** cold `up` + `down`+`up` volume-survival smoke (AC6). **R7 — migration-on-boot** verified by cold start. [Source: handoff#Quality-Gates]
- **R3 seed:** empty `GET /todos` returns `200 []` (never null) — the first contract assertion. [Source: handoff#1.1 P0]
- **Frameworks (design-only, drop in after this story scaffolds):** Playwright (E2E + api-integration through proxy), Vitest+RTL (web unit), Go test+testify (api). **No hard waits** (`waitForTimeout` banned) — network-first + fake clock. Copy `_bmad-output/test-artifacts/framework-design/*` into the real `web/` and `api/` per that README's drop-in steps once the skeleton exists. Prefer role/label/placeholder locators; `data-testid` as backstop (`empty-state`, `loading-skeleton`, `error-state` recommended hooks). [Source: framework-design/README.md; project-context.md#Testing-Rules]

### Stack versions (verified Jul 2026 — code owns them once manifests exist; read the manifest before assuming)
Next.js 16.2 LTS · TanStack Query 5.x · Go 1.26 · Gin 1.12 · golang-migrate 4.x · PostgreSQL 18 · Docker Compose (current). [Source: ARCHITECTURE-SPINE.md#Stack; project-context.md]

### Critical don't-miss anti-patterns (from project-context.md)
- ❌ Never return a nil slice from `GET /todos` — emit `[]`.
- ❌ Never expose `api`/`db` on a host port; never commit secrets; never require manual setup steps.
- ❌ Never evolve schema outside a versioned `golang-migrate` file (no `AutoMigrate`, no `init.sql`).
- ❌ Never put business logic/validation in the Next proxy or a Gin handler.
- ❌ Never write raw/unparameterized SQL, and never put SQL outside `repository/` (seed helper uses parameterized SQL via the DB handle).
- ❌ Never hand-maintain a second copy of the wire contract — derive from `shared/` (Go side formalized in 1.2).
- ❌ Never let the proxy leak an HTML error page or a thrown fetch — synthesize AD-9 shape on `api` failure.

### Project Structure Notes
- Aligns 1:1 with the Structural Seed; no variances expected. This story *creates* the structure the rest of the project depends on — get the directory boundaries right (handler/service/repository split, `shared/`, `testhelpers/`).
- One decision to make and document: Postgres driver (`pgx` recommended for Go 1.26 + Postgres 18). Record the choice in the README so 1.2 follows it.
- `gen_random_uuid()` needs `pgcrypto` (or `uuid-ossp`) — enable the extension in the migration.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1] — ACs, epic scope, story-step split, test-design tasks.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md] — AD-1…AD-12, Structural Seed, Stack, Consistency Conventions.
- [Source: _bmad-output/project-context.md] — condensed binding rules + anti-patterns (AD traceability).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-todo-app-2026-07-17/DESIGN.md] — token values, typography, empty-state spec, microcopy.
- [Source: _bmad-output/test-artifacts/test-design/todo-app-handoff.md] — per-story P0 scenarios, risk-to-story map, Epic 1 quality gate.
- [Source: _bmad-output/test-artifacts/framework-design/README.md] — drop-in test framework, TC1/TC5/R9/R3/R1 wiring.
- [Source: _bmad-output/specs/spec-todo-app/resolved-decisions.md] — RD-6 (first-load theme via OS `prefers-color-scheme`) relevant to token scoping.

### Open questions for the human — RESOLVED during implementation
1. **Postgres driver:** RESOLVED → chose **pgx/v5** (`github.com/jackc/pgx/v5` + pgxpool) for app queries; golang-migrate uses its `postgres` database driver (lib/pq, pulled indirect) for the URL-based migrator. Documented in README.
2. **Dark-value scoping:** RESOLVED → both value sets defined now; dark is inert under `:root[data-theme="dark"]` and NOT auto-applied via `prefers-color-scheme`. App ships light-rendered; Epic 3 (Story 3.4) wires the toggle + RD-6 first-load logic. Matches the recommended approach.
3. **List path depth:** RESOLVED → built the full `handler → service → repository` `ListTodos` path now (not a handler stub). Proven end-to-end by the durability check, which returned a real row in correct AD-6 shape — this is the seam Story 1.3 fills.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD dev-story workflow.

### Debug Log References

- **Go toolchain:** `pgx/v5 v5.10.0` requires Go ≥1.25; bumped `go.mod` to `go 1.26` and used `golang:1.26-alpine` (matches the architecture seed). Go/psql are not installed on the host, so `go mod tidy`, `go vet`, `go test`, `gofmt`, and both build-tag builds were all run inside a `golang:1.26-alpine` container.
- **PostgreSQL 18 data dir:** first `docker compose up` failed — `db` exited(1) with "in 18+ … place a single mount at /var/lib/postgresql". Fixed by mounting the named volume at `/var/lib/postgresql` (not `/…/data`).
- **Next standalone layout:** `.next/standalone/server.js` sits at the standalone root (no parent workspace detected), so the runtime Dockerfile copies `server.js`/`node_modules`/`.next` to `/app` and runs `node server.js`.
- **Vitest token test:** under jsdom `import.meta.url` is not a `file:` URL; switched to `resolve(process.cwd(), 'app/globals.css')`.

### Completion Notes List

Story 1.1 implemented and verified end-to-end. All 9 ACs satisfied.

**Verification evidence:**
- **AC1** — `docker compose up` brought services up healthcheck-gated in order: `db Healthy → api Healthy → web Started`. `docker compose ps` shows only `web` host-published (`0.0.0.0:3000`); `api`/`db` expose internal container ports only.
- **AC2 / AC9** — `GET /api/todos` through the same-origin proxy returned `200 []` (bare array, not null). Browser-verified the empty state renders ("todo" wordmark + accent dot, "Nothing here yet", locked subline) — never a blank screen.
- **AC3** — api logs show `applying migrations → migrations applied → api serving` (migrate before serve). `\d todos` confirms exact schema incl. `todos_status_check CHECK (status IN ('active','completed'))` and the `created_at DESC, id DESC` index.
- **AC4** — web quality gate green: `eslint` (0), `prettier --check` (clean), `vitest` (3 passing), `next build` (ok). README documents clone→`docker compose up` with zero manual steps. `.env.example` documents all config; no secrets committed.
- **AC5** — all 9 light + 9 warm-dark tokens defined as CSS variables (`tokens.test.ts` guards presence); warm palette rendered live in the browser. Toggle deferred to Epic 3.
- **AC6** — inserted a row, `docker compose down` (kept volume), `up` → row survived and returned in AD-6 wire shape (camelCase, `metadata` nesting, RFC3339 `…Z` second-precision timestamps).
- **AC7** — `GET /health` returns `200 {"status":"ok"}`; drives the compose `api` healthcheck.
- **AC8** — `api/testhelpers/seed.go` is `//go:build testseed` guarded; prod build excludes it, `go build -tags testseed ./...` compiles it. Parameterized SQL only.

**Go tests:** 6 handler tests pass (empty→`[]`, nil-slice→`[]`, wire shape, health ok/503, error envelope). `go vet` clean, `gofmt` clean.

**Deviations from the story seed (all documented above / in Project Structure Notes):**
- Added `api/model/` (domain entity) and `api/db/` (migrate+pool glue) packages — justified minor additions to the Structural Seed.
- `golangci-lint` was flagged as a follow-up at dev time; it was added and run during code review (`api/.golangci.yml`, v2.12.2 → 0 issues), so the full Go gate (`gofmt`+`go vet`+`golangci-lint`) is now committed and passing.
- `go 1.26` / `golang:1.26-alpine` required by pgx/v5 (consistent with the architecture's Go 1.26 seed).

### File List

**New — shared/**
- `shared/todo.ts` — single source-of-truth wire contract (AD-6)
- `shared/README.md`

**New — api/**
- `api/go.mod`, `api/go.sum`
- `api/main.go`
- `api/db/db.go` — migrate-on-boot + pgx pool
- `api/handler/handler.go`, `api/handler/handler_test.go`
- `api/service/service.go`
- `api/repository/repository.go`
- `api/model/todo.go`
- `api/migrations/000001_create_todos.up.sql`, `.down.sql`, `api/migrations/embed.go`
- `api/testhelpers/seed.go` (testseed-tagged)
- `api/Dockerfile`
- `api/.golangci.yml` (added during code review)

**New — web/**
- `web/package.json`, `web/package-lock.json`
- `web/tsconfig.json`, `web/next.config.mjs`, `web/eslint.config.mjs`, `web/.prettierrc.json`, `web/.prettierignore`
- `web/vitest.config.ts`
- `web/app/layout.tsx`, `web/app/page.tsx`, `web/app/providers.tsx`, `web/app/error.tsx`, `web/app/globals.css`
- `web/app/api/[...path]/route.ts` — dumb proxy
- `web/app/components/Wordmark.tsx`, `web/app/components/EmptyState.tsx`
- `web/lib/todos.ts`
- `web/tests/setup.ts`, `web/tests/empty-state.test.tsx`, `web/tests/tokens.test.ts`
- `web/public/.gitkeep`
- `web/Dockerfile`

**New — root**
- `docker-compose.yml`, `.env.example`, `.dockerignore`, `README.md`

**Modified**
- `.gitignore` — added node/Go/`.env` ignores
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status transitions
- `_bmad-output/implementation-artifacts/1-1-project-skeleton-one-command-startup.md` — this story file

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-17 | Story 1.1 implemented: greenfield monorepo scaffold (`web`/`api`/`shared`), one-command `docker compose up`, migrations-on-boot + `todos` table, `GET /todos` (`[]`) + `GET /health`, dumb proxy, TanStack Query empty state, Cream & Terracotta CSS-variable tokens, test-only seed/reset seam. All 9 ACs verified end-to-end (compose up, browser, durability). Status → review. |
| 2026-07-18 | Code review (3 adversarial layers). 4 patches applied (proxy hardening, compose startup resilience, golangci-lint gate added, `/health` AD-9 envelope), 4 low-severity items deferred, 4 dismissed as false-positive/by-design. Re-verified: web+go gates + golangci-lint clean, stack healthy end-to-end. Status → done. |
