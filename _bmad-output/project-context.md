---
project_name: 'todo-app'
user_name: 'Alivara'
date: '2026-07-17'
sections_completed:
  [
    'technology_stack',
    'architecture_layering',
    'wire_contract',
    'client_behavior',
    'server_rules',
    'persistence_deployment',
    'testing_rules',
    'naming_quality',
    'anti_patterns',
  ]
status: 'complete'
rule_count: 60
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**Monorepo, three units — `web/`, `api/`, `shared/` — orchestrated by one `docker-compose.yml`.**

| Layer | Tech | Version | Notes |
| --- | --- | --- | --- |
| web (client + dumb BFF proxy) | Next.js (React) | 16.2 LTS | No business logic; proxies `/api/*` |
| web server-state | TanStack Query (`@tanstack/react-query`) | 5.x | Sole owner of server state |
| api (REST service) | Go | 1.26 | Layered handler→service→repository |
| api HTTP framework | Gin (`gin-gonic/gin`) | 1.12 | HTTP concerns only, in handlers |
| migrations | golang-migrate | 4.x | Versioned SQL, applied on boot |
| db | PostgreSQL | 18 | Reached only via repository |
| orchestration | Docker Compose | current | Only `web` exposes a host port |

**Testing stack:** Playwright (E2E + api-integration through the proxy), Vitest + React Testing Library (web unit), Go test + testify (api unit/integration), k6 (perf — deferred).

**Quality gates (committed + CI-checkable):** `eslint` + `prettier` in `web`; `gofmt` + `golangci-lint` in `api`.

> Versions are a seed verified current at authoring (Jul 2026); **the code owns these once it exists** — read the actual manifests before assuming.

## Critical Implementation Rules

### Architecture & Layering (the one-way dependency spine)

- **Dependencies point inward and downward, never sideways or up.** `web → api contract → handler → service → repository → db`. Nothing depends back.
- **`api` layering is strict (AD-1):** HTTP concerns live **only** in `handler/`; business rules (validation, status transitions, ordering) live **only** in `service/`; **all** persistence goes through the `repository/` interface. Never write SQL in a handler; never import Gin from a service.
- **The repository is a Go interface (AD-2)** — the multi-user seam. Keep it clean today (no speculative `user_id`/scope param). Multi-user is later added by threading owner scope through this one interface + a `WHERE user_id = $1`, contained to repository + service.
- **The Next proxy is dumb (AD-3):** browser calls **same-origin `web`**, which forwards `/api/*` to `api` on the internal network. Pure pass-through — no rules, no reshaping, no data ownership. It forwards `api` responses **verbatim** (status + JSON body untouched). If `api` is unreachable or times out, the proxy synthesizes an **AD-9-shaped error** (`502`/`504` with `{ error: { code, message } }`) — it must never leak an HTML error page or a thrown fetch to the browser.
- **Gin is the single source of business-rule and validation truth.** No business logic in the Next runtime.

### The Wire Contract (`web ↔ api`) — enforced from ONE shared type

- **Single source of truth (AD-6):** the todo shape, field names, casing, envelope, and success codes live in **one `shared/` type** that both `web` and `api` derive from. Never hand-maintain a second copy — a divergence must surface as a **build/type error, not a runtime bug**.
- **Resource shape:** `{ id (uuid), title (string), description (string), status ("active"|"completed"), metadata: { createdAt, updatedAt } }`. Timestamps are **nested under `metadata`**.
- **camelCase on the wire.** Go structs carry `json` tags (exported PascalCase → camelCase); Postgres columns stay `snake_case`.
- **`description` is `""` when empty, never `null`** — the client must never branch on null.
- **`GET /todos` returns a bare JSON array**, and **`[]` (never `null`) when empty** — the Go handler must emit an empty slice, not a nil slice.
- **`POST /todos`** body `{ title, description? }`; server assigns `id`/`status`/timestamps and **ignores any client-supplied `id`/`status`/`metadata`**.
- **`PATCH /todos/:id`** sends **only the fields being changed** (`title`/`description`/`status`); an **absent field means unchanged** — decode as optional/pointer, **never a zero-value overwrite**. Any combination is atomic in one call.
- **Success codes:** `POST` → `201` + full resource; `PATCH` → `200` + full resource; `DELETE` → `204` empty. A commit-`DELETE` returning **`404` (already gone) is treated as success**, not an error.
- **Endpoints:** `GET /todos` · `POST /todos` · `PATCH /todos/:id` · `DELETE /todos/:id` · `GET /health`. Use **`PATCH`, not `PUT`**. Unversioned. REST paths are lowercase plural nouns.

### Client Behavior (`web`) — optimistic UI & pending-delete

- **TanStack Query is the sole owner of server state (AD-4).** Todos live in the **query cache only** — no component keeps its own copy of the server-derived list.
- **Every mutation pairs `onMutate` (apply optimistically) with `onError` (roll back visibly)** and settles against the server. A rejected mutation must **visibly roll back** and refetch so the UI equals the server (never silently hide a server failure).
- **Identity/timestamps are server-authoritative (AD-7).** On optimistic add the client mints a **temporary id**, prepends the todo, then **swaps in the real UUID** from the `201` body on settle. Temp ids are never persisted. The client **renders relative time from `createdAt`** but never generates timestamps.
- **Ordering:** server returns newest-first (`ORDER BY created_at DESC, id DESC`). The client **never re-sorts**; optimistic-add **prepends** so position matches the server on settle.
- **Pending-delete is a client-side lifecycle (AD-5):** delete removes the row immediately and starts a **client-owned ~5s timer**. **No network call during the window**; undo cancels the timer with no round-trip. On elapse the real `DELETE` fires. **On page unload with a delete still pending, flush via `navigator.sendBeacon` (or `fetch` with `keepalive: true`)** so reload/close = committed and the todo does not reappear. The server never knows a delete was "pending."
- **Error handling splits by class (AD-9):** a **`4xx` validation error → inline feedback, no Retry** (retrying malformed input is futile); a **`5xx`/network/timeout → error state + Retry path**. No raw exception reaches the user; a React error boundary is the backstop.

### Server Rules (`api`) — validation, status, errors, persistence

- **Validation is server-authoritative, mirrored on the client (AD-10)** — a client check is never the sole gate. Rules:
  - **`title` required** — non-empty/non-whitespace, **≤200**.
  - **`description` optional** — may be blank, **≤2000**.
  - Both caps counted in **Unicode code points (runes)** — not UTF-16 units, not bytes.
  - **Whitespace is trimmed before validation on both sides; the cap is applied after trim** — so optimistically rendered text equals persisted text.
- **`status` is Postgres `text` + a `CHECK` constraint (AD-8)**, not a native PG enum type. Current values `active | completed`. The allowed list is kept in sync in exactly **two places** — the DB `CHECK` and Go service validation. Adding a state edits that list; it never `ALTER TYPE`s.
- **Uniform error contract (AD-9):** every non-2xx is `{ "error": { "code", "message" } }` with an apt status. `code` is a **fixed vocabulary**: `validation_error` (400), `not_found` (404), `internal_error` (500; proxy also emits it for 502/504).
- **`id` is a server/DB-generated UUID v4.** `createdAt`/`updatedAt` are set **server-side, RFC3339 UTC with trailing `Z`, second precision** (e.g. `2026-07-17T14:03:11Z`); `updatedAt` updates on every create/edit/status change.
- **SQL is always parameterized**; server-side sanitization is authoritative. Rely on React's default output-escaping for XSS on render.
- **`api` uses structured logging.** No unhandled error reaches the user.

### Persistence, Migrations & Deployment

- **Schema evolves only through versioned migrations (AD-11):** every schema change is a `golang-migrate` up/down SQL pair under `api/migrations/`, **embedded in the `api` binary and applied automatically on startup before it serves**. No hand-run SQL, no ORM `AutoMigrate`, no create-once `init.sql`.
- **Compose topology (AD-12):** three services — `web`, `api`, `db`. **Only `web` exposes a host port** (the sole entry point); `api` and `db` are **internal-only**.
- **Startup is healthcheck-gated:** `db` healthy → `api` (migrate, then serve; readiness at **`GET /health`**) → `web`. `api` must not race an unready `db`.
- **`db` uses a named volume; todo data must survive `docker compose down` + `up`.** A silent mount failure that quietly starts empty is a **durability defect**, not acceptable.
- **Config is 12-factor env vars with working defaults baked into compose** so bare `docker compose up` just works. `.env.example` documents them. **No secrets committed.**
- **Bare `docker compose up` must be zero-touch** — clone → run in ≤10 min, no manual schema/config steps.

### Testing Rules

- **Test levels by layer:** Playwright for **E2E + api-integration through the proxy** (`web/tests/e2e/`, `web/tests/integration/`); Vitest + RTL for **web unit** (mutation/rollback logic, formatters, rune-count); Go test + testify for **api unit + integration** (validation, status transitions, contract, injection, repository↔Postgres).
- **No hard waits — `waitForTimeout` is banned.** Use **network-first** synchronization (wait on requests/responses) and a **fake clock** (`installClock()`) for the ~5s undo window and relative-time assertions.
- **Tests are self-cleaning and parallel-safe.** Use the **test-only seed/reset seam** — `seedTodos()`/`resetTodos()` (web fixtures) and `api/testhelpers/seed.go` (Go, build-tag `testseed` guarded, parameterized SQL). This path is **test-profile only, never prod-reachable**.
- **Generate unique data with faker** (`makeTodo` factory); never rely on shared fixed rows across tests.
- **Locators:** prefer **role/label/placeholder** locators over `data-testid` — current Playwright guidance, and it doubles as a semantic-controls check.
- **Assert the AD-6 contract explicitly** via reusable helpers (`contract.ts`): `[]`≠null, `""`≠null, camelCase, `metadata` nesting, partial PATCH, `201`/`200`/`204`, 404-as-success.
- **Style:** Given-When-Then structure, explicit assertions, no secrets in any test file (`BASE_URL` from env).
- **The flagship P0 tests:** optimistic-rollback (forces server rejection, asserts visible rollback + refetch equals server) and the create core-loop E2E.

### Naming & Code Quality

- **Naming across boundaries:** Wire/JSON → **camelCase**; Go → exported **PascalCase** + `json` tags; Postgres → **snake_case** tables/columns; REST paths → lowercase plural noun (`/todos`).
- **Source tree (monorepo):**
  - `web/app/` (routes, components, error boundary), `web/lib/` (TanStack Query client, api proxy handlers, pending-delete controller)
  - `api/handler/`, `api/service/`, `api/repository/`, `api/migrations/`
  - `shared/` (single source-of-truth wire type — both `web` and `api` derive from it)
- **Formatters/linters are the gate:** `eslint` + `prettier` (web), `gofmt` + `golangci-lint` (api) — all committed and CI-checkable.
- **`web` is responsive, mobile-first from ~375px up.**

### Critical Don't-Miss Rules (anti-patterns)

- ❌ **Never return a nil slice from `GET /todos`** — emit an empty slice so JSON is `[]`, never `null`.
- ❌ **Never emit `null` for an empty `description`** — use `""`.
- ❌ **Never let `PATCH` zero-value-overwrite** an absent field — decode optional fields as pointers; absent = unchanged.
- ❌ **Never trust client-supplied `id`/`status`/`metadata` on `POST`** — the server assigns them.
- ❌ **Never treat a commit-`DELETE` `404` as an error** — it means already-gone = success.
- ❌ **Never put business logic or validation in the Next proxy or a Gin handler** — services own rules, handlers own HTTP only.
- ❌ **Never write raw/unparameterized SQL, and never put SQL outside `repository/`.**
- ❌ **Never count title/description caps in bytes or UTF-16 units** — use Unicode runes, after trimming whitespace.
- ❌ **Never let the client re-sort the list or generate timestamps/real ids** — server is authoritative; temp ids are swapped on settle.
- ❌ **Never fire the delete network call during the undo window** — only on elapse, or flush via `sendBeacon`/`keepalive` on unload.
- ❌ **Never hide a failed mutation** — optimistic updates must roll back visibly and reconcile with the server.
- ❌ **Never use `waitForTimeout` / hard waits in tests** — network-first + fake clock.
- ❌ **Never expose `api` or `db` on a host port; never commit secrets; never require manual setup steps.**
- ❌ **Never hand-maintain a second copy of the wire contract** — derive both sides from `shared/`.
- ❌ **Never evolve the schema outside a versioned `golang-migrate` file** — no `AutoMigrate`, no manual SQL.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow ALL rules exactly as documented; when in doubt, prefer the more restrictive option.
- Rules trace to architecture decisions **AD-1 … AD-12** in `_bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md` — consult it for the full rationale.
- This is greenfield: **read the actual manifests/config once code exists** — the code owns the versions and details, this file is the intent.

**For Humans:**

- Keep this file lean and focused on agent needs.
- Update when the wire contract (AD-6), stack versions, or an architecture decision changes.
- Review periodically; remove rules that become obvious once the code exists.

Last Updated: 2026-07-17
