# Epic 1 Context: Foundation & Task Capture

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Epic 1 stands up a running, demoable walking skeleton of the todo app and delivers the create-and-view happy path on top of it. From a clean clone, `docker compose up` must bring the full stack (`web` + `api` + `db`) online, healthcheck-gated, with schema migrations applied automatically on boot and data persisting durably in PostgreSQL. On that foundation the user can add a task that appears optimistically at the top of the list and see their existing tasks load automatically, newest-first, on open. A minimal resilience floor ships alongside — optimistic add-rollback, a basic loading indicator, a bare empty state, and basic fetch-error handling — so a failed create never leaves a phantom row and the first load is never a blank screen. This matters because it turns the project from scaffold into something honestly usable and demo-worthy end-to-end, and it establishes the wire contract, layered backend, and design-token system that every later epic builds on.

## Stories

- Story 1.1: Project skeleton & one-command startup
- Story 1.2: Create a todo (optimistic, end-to-end)
- Story 1.3: View the persistent task list

## Requirements & Constraints

- One-command startup: a clean clone runs with `docker compose up`, no undocumented steps; a new developer reaches a running app in ≤10 minutes via the README.
- Three services (`web`, `api`, `db`); only `web` exposes a host port, `api`/`db` are internal-only, `db` uses a named volume. Startup is healthcheck-gated: `db` healthy → `api` migrates then serves → `web`.
- Config is 12-factor with working defaults baked into compose; `.env.example` documents all config; no secrets committed.
- Durable persistence: todos survive server restarts, browser sessions, and `compose down`+`up` (named-volume durability check). No data loss, no stale reads.
- Create validation is server-authoritative and mirrored client-side: `title` required, non-empty after trim, ≤200 Unicode code points; `description` optional, ≤2000 code points; whitespace trimmed before validation, cap applied after trim. Boundary is inclusive (200 accepted, 201 rejected); count by code point (a multi-code-point grapheme counts as more than one).
- Empty/whitespace-only title is rejected inline within the same interaction with no server request sent and focus retained.
- Optimistic create renders in ≤100ms; API responses target p95 ≤300ms under single-user load. Optimistic add must be guarded against accidental double-submit (double-Enter creates exactly one todo).
- On server rejection of an add (5xx/network/timeout), the phantom row rolls back visibly with no silent divergence between what is shown and what is persisted.
- List loads automatically on open, ordered newest-first, and the client never re-sorts server order.
- Each todo displays title, optional description, status, and a relative creation time; client renders relative time only and never generates timestamps.
- Loading state appears immediately and resolves to content with no intervening blank screen; a failed fetch shows a non-disruptive error with a working retry.
- Quality gate is committed and passing: `eslint` + `prettier` in `web`, `gofmt` + `golangci-lint` in `api`.
- Prerequisite: the SPEC open question on testing conventions (framework, coverage, unit/integration/e2e split) must be resolved before development begins — it gates the quality gate, not a parallel track.
- The data model and API must be structured so future auth / multi-user scoping can be added without a rewrite.

## Technical Decisions

- Monorepo layout: `web/` (Next.js client + dumb BFF proxy), `api/` (Gin: `handler/`, `service/`, `repository/`, `migrations/`), plus `docker-compose.yml`, `.env.example`, `README.md`. Greenfield — no starter template; scaffold from scratch.
- Layered backend with one-way dependency `handler → service → repository`: HTTP concerns only in handlers, business rules (validation, status transitions, ordering) only in services, all persistence through the repository interface, never reversed.
- The repository interface is the multi-user seam: every persistence op is a method on a Go repository interface, kept clean today (no speculative scope param); multi-user later means threading an owner scope through this one interface plus `WHERE user_id = $1`.
- The Next.js proxy is dumb: the browser calls same-origin `web`, which forwards `/api/*` to `api` on the internal network verbatim (status + JSON body untouched); no CORS. If `api` is unreachable/times out, the proxy synthesizes an error-shaped `502`/`504`, never an HTML page or thrown fetch.
- Wire contract (fixed): camelCase on the wire; timestamps nested under `metadata`; `description` is `""` never `null`; `GET /todos` returns a bare array (`[]` never `null`); `POST` ignores client-supplied `id`/`status`/`metadata`; success codes `POST`→201+resource, `DELETE`→204. Introduce a shared wire-contract type that `web` and `api` both derive from before the client consumes it.
- REST surface: `GET /todos` · `POST /todos` (Epic 1 uses create + list; PATCH/DELETE arrive in Epic 2). Unversioned. List ordering is server-side `ORDER BY created_at DESC, id DESC`; optimistic-add prepends; same-second creations tiebreak by `id DESC`.
- Identity + timestamps are server-authoritative: `id` is a server/DB-generated UUID v4; optimistic add mints a temp id then swaps it for the server UUID on the `201` body. `createdAt`/`updatedAt` are set server-side as RFC3339 UTC with trailing `Z`, second precision.
- `status` is an extensible text enum: stored as Postgres `text` + `CHECK` (currently `active` | `completed`); the allowed-values list is kept in sync in exactly two places — DB `CHECK` and Go service validation. Adding a state means editing that list, not migrating a type.
- Uniform error contract: every non-2xx is `{ "error": { "code", "message" } }`; Epic 1 needs `validation_error` (400) for creates and `internal_error` for failures. Client splits handling: 4xx → inline feedback (no retry); 5xx/network/timeout → error state + retry.
- Schema evolves only via versioned `golang-migrate` up/down SQL under `api/migrations/`, embedded in the `api` binary and applied automatically on startup before serving — no manual schema steps. Initial migration creates the `todos` table: `id` uuid PK, `title` text, `description` text, `status` text + CHECK, `created_at`/`updated_at` timestamptz.
- Validation: SQL is parameterized; server-side sanitization is authoritative; rely on React default output-escaping for XSS on render.
- Server state ownership: TanStack Query is the sole owner of server state — todos live in the query cache only. The optimistic add pairs `onMutate` (optimistic apply) with `onError` (visible rollback) and settles against the server; no component holds a private server-derived list.
- Structured logging in `api`.
- Verified stack (Jul 2026): Next.js 16.2 LTS · TanStack Query 5.x · Go 1.26 · Gin 1.12 · golang-migrate 4.x · PostgreSQL 18 · Docker Compose.
- Test-design enablers to scaffold in the infra story: a `GET /health` readiness route and a test-only seed/reset seam in the repository, both unblocking integration/E2E.

## UX & Interaction Patterns

- Design-token system from day one: implement the Cream & Terracotta token set as CSS variables with both light (default) and warm-dark values, plus the typography system (one rounded humanist sans; weight, not size, carries row-level hierarchy) and layout primitives (4px spacing scale, rounding tokens, soft warm low elevation). The theme toggle itself is deferred to Epic 3 — only the tokens ship here. The single terracotta accent is for action/payoff only, never alarm.
- Wordmark: lowercase "todo" + a terracotta accent dot, top-left header.
- Add-input: a raised field pinned to the top of the list, focused on load and re-focused after every add; focused resting state with accent border + accent-soft ring; a pill "Add" button as an equal alternative to Enter; placeholder "Add a task…".
- Task row (active): raised card with a circular empty checkbox, title (primary), optional description line clamped to ~2 lines with a soft fade + inline "more" reveal (expands in place, does not enter edit mode), and a relative timestamp.
- "Pops to top" on add: a newly added task animates in at the top, directly below the add input; motion decorates the change and never blocks the ≤100ms optimistic render.
- Bare empty state: "Nothing here yet" with subline "Add your first task above — it'll show up right here." (minimal version; the polished illustration is Epic 3). The focused add-input remains the CTA above it.
- Keyboard is inherent to the core loop: Enter submits an add; the add input stays focused so a user can type-Enter-type-Enter without the mouse. Controls are semantic (real button/checkbox/input) with a visible accent focus ring.
- Layout: a single centered column (max-width ≈560px desktop; full-width with ~18px side padding on mobile), functional and polished from ~375px up, same composition at every width.
- Lock the confirmed microcopy strings exactly (wordmark "todo"; placeholder "Add a task…"; empty-state strings above). Voice is warm, friendly, restrained, reassuring — lowercase plain sentences, no jargon/status-codes/emoji.

## Cross-Story Dependencies

- Story 1.1 (infra walking-skeleton) must land first: it establishes the monorepo, compose stack, migrations-on-boot, `todos` table, design tokens, `GET /health` route, and the repository test seam that Stories 1.2 and 1.3 depend on.
- Story 1.2 introduces the shared wire-contract type that both `web` and `api` derive from; Story 1.3's list rendering consumes the same contract and the `POST`-created records.
- The optimistic-add rollback and minimal loading/empty/error floor shipping in Epic 1 are prerequisites for Epic 2 (edit/toggle/delete reuse a shared optimistic-mutation wrapper) and Epic 3 (which upgrades this floor to the polished, systematized layer). The `status` enum, wire contract, and durable list built here are the direct foundation for Epic 2's mutations.
