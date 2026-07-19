---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - prds/prd-todo-app-2026-07-17/prd.md
  - prds/prd-todo-app-2026-07-17/addendum.md
  - architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md
  - ux-designs/ux-todo-app-2026-07-17/DESIGN.md
  - ux-designs/ux-todo-app-2026-07-17/EXPERIENCE.md
  - ../specs/spec-todo-app/SPEC.md
---

# todo-app - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for todo-app, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: User can create a todo by typing a required short title and submitting via the Enter key or an "Add" button; an optional longer description can be added at creation or later.
FR2: A new todo appears in the list immediately (optimistic), carrying its title, any description, `status = active`, and system-set `created_at` / `updated_at` timestamps.
FR3: An empty or whitespace-only title is rejected with inline validation feedback within the same interaction; no todo is created (description is optional and may be blank).
FR4: After a successful add, the input clears and stays focused for rapid entry.
FR5: On opening the app, the full todo list loads and displays automatically — no action required.
FR6: Each todo displays its title, its description (when present), its status, and a relative creation time (e.g., "2 hours ago").
FR7: Todos with `status = completed` are visually distinct from `active` ones (strikethrough + muted styling).
FR8: The list is ordered newest-first (most recently created at the top).
FR9: User can edit a todo's title and description in place via a clear affordance (click/tap the field or an edit control).
FR10: Edits save on confirm (Enter or blur), applied optimistically and persisted; Esc cancels and reverts.
FR11: An edit that leaves the title empty/whitespace is rejected and reverts to the prior title; the description may be cleared (it is optional).
FR12: User can toggle a todo's `status` between `active` and `completed` via a clear control (checkbox/tap); the change reflects instantly (optimistic) and persists.
FR13: User can delete a todo via a clear affordance; it is removed from the visible list immediately (optimistic) and enters a pending-delete state not yet committed to the backend.
FR14: During the pending-delete window (~5s), an Undo toast is shown; activating Undo cancels the pending deletion and restores the todo in place, with no data loss and no server round-trip.
FR15: If the window elapses without Undo, the deletion is committed to the backend; if the app is closed or reloaded while a delete is pending, the deletion is treated as committed (the todo does not reappear).
FR16: The backend exposes a small REST API supporting CRUD: create, list, update (title + description + status), and delete todos.
FR17: Todo data persists durably in a datastore, surviving server restarts and browser sessions.
FR18: The API returns appropriate HTTP status codes and structured error responses on failure.
FR19: Each todo record carries: unique id, `title` (required), `description` (optional), `status`, `created_at`, `updated_at`. `status` is a constrained enum (`active` | `completed`) modeled to admit future states without a schema rewrite; timestamps are system-managed and not user-editable.
FR20: Empty state — when no todos exist, show a friendly prompt to add the first one.
FR21: Loading state — show a clear indicator while the list is fetching.
FR22: Error state — when an API call fails, show a non-disruptive message with a retry path; activating retry re-issues the failed request.
FR23: Optimistic actions (add/edit/toggle/delete) roll back visibly if the server rejects them, restoring the pre-action state.
FR24: `title` is capped at 200 characters and `description` at 2000, enforced both client- and server-side, with clear feedback as a limit is approached or exceeded.

### NonFunctional Requirements

NFR1: Core interactions feel instantaneous — optimistic UI updates render ≤100ms; API responses p95 ≤300ms under normal single-user load.
NFR2: Initial list load renders promptly — the loading state appears immediately and resolves to content without an intervening blank screen.
NFR3: Todo data is durably persisted and consistent across refreshes, sessions, and server restarts (no data loss, no stale reads).
NFR4: The app degrades gracefully on failure — a failed operation never corrupts state or leaves the UI inconsistent (optimistic rollback).
NFR5: Fully functional and visually polished on modern desktop and mobile browsers, from ~375px mobile width up.
NFR6: Code is clean, conventional, and readable — linter/formatter config committed and passing; consistent project structure.
NFR7: Setup is documented and reproducible — a new developer can clone, install, and run locally in ≤10 minutes via the README, with no undocumented steps.
NFR8: The architecture cleanly accommodates future auth / multi-user (data model and API structured so user-scoping can be added without a rewrite).
NFR9: Both client and server handle failures gracefully with clear, non-disruptive feedback; no unhandled exceptions surface to the user in normal use.
NFR10: Inputs are validated and sanitized server-side (not only client-side).
NFR11: The application is containerized and starts with a single `docker compose up`, bringing up the full stack (frontend + backend + datastore).

### Additional Requirements

**Starter template:** NONE specified in Architecture — this is a greenfield monorepo scaffold. Epic 1 Story 1 must establish the project skeleton from scratch (no starter/boilerplate template to clone).

Monorepo source tree (Architecture Structural Seed): `web/` (Next.js client + dumb BFF proxy), `api/` (Gin: `handler/`, `service/`, `repository/`, `migrations/`), `docker-compose.yml`, `.env.example`, `README.md`.

- AR1 (AD-1): Layered backend with one-way dependency — HTTP concerns only in handlers, business rules (validation, status transitions, ordering) only in services, all persistence through the repository interface; dependencies flow `handler → service → repository`, never reversed.
- AR2 (AD-2): The repository interface is the multi-user seam — every persistence op is a method on a Go repository interface, kept clean today (no speculative scope param); multi-user later = threading an owner scope through this one interface plus `WHERE user_id = $1`.
- AR3 (AD-3): The Next.js proxy is dumb — browser calls same-origin `web`, which forwards `/api/*` to `api` on the internal network verbatim (status + JSON body untouched); no CORS; on `api` unreachable/timeout the proxy synthesizes an AD-9-shaped `502`/`504` error, never an HTML page or thrown fetch.
- AR4 (AD-4): TanStack Query is the sole owner of server state — todos live in the query cache only; every mutation pairs `onMutate` (optimistic apply) with `onError` (visible rollback) and settles against the server; no component holds a private server-derived list.
- AR5 (AD-5): Pending-delete is a client-side lifecycle — delete removes the row + starts a client ~5s timer with no network call; Undo cancels with no round-trip; on elapse the real `DELETE` fires; on unload/close while pending the client flushes via `navigator.sendBeacon` (or `fetch keepalive:true`).
- AR6 (AD-6): Fixed `web ↔ api` wire contract — camelCase on the wire; timestamps nested under `metadata`; `description` is `""` never `null`; `GET /todos` returns a bare array, `[]` never `null`; `POST` ignores client `id`/`status`/`metadata`; `PATCH` sends only changed fields (absent = unchanged, never zero-value overwrite); success codes `POST`→201+resource, `PATCH`→200+resource, `DELETE`→204; a commit-`DELETE` returning `404` is treated as success.
- AR7 (AD-7): Identity + timestamps server-authoritative — `id` = server/DB-generated UUID v4; optimistic add mints a temp id then swaps on the `201` body; `createdAt`/`updatedAt` set server-side RFC3339 UTC with trailing `Z`, second precision; client renders relative time only, never generates timestamps.
- AR8 (AD-8): `status` is an extensible text enum — stored as Postgres `text` + `CHECK` (current `active` | `completed`); allowed-values list kept in sync in exactly two places (DB `CHECK` + Go service validation); adding a state = editing that list, not migrating a type.
- AR9 (AD-9): One uniform error contract — every non-2xx is `{ "error": { "code", "message" } }` with fixed code vocabulary (`validation_error` 400, `not_found` 404, `internal_error` 500/502/504); client splits handling: 4xx → inline feedback (no retry); 5xx/network/timeout → error state + Retry.
- AR10 (AD-10): Validation server-authoritative + mirrored client-side — `title` required non-empty ≤200; `description` optional ≤2000; caps counted in Unicode code points (runes); whitespace trimmed before validation on both sides, cap after trim; SQL parameterized; server-side sanitization authoritative.
- AR11 (AD-11): Schema evolves only via versioned `golang-migrate` up/down SQL under `api/migrations/`, embedded in the `api` binary and applied automatically on startup before serving — no manual schema steps.
- AR12 (AD-12): Deployment & config envelope — three compose services (`web`, `api`, `db`); only `web` exposes a host port; `api`/`db` internal-only; `db` on a named volume; healthcheck-gated startup (`db` healthy → `api` migrate+serve → `web`); 12-factor env with working defaults baked into compose; `.env.example` documents them; no secrets committed.
- AR13 (Conventions): REST surface = `GET /todos` · `POST /todos` · `PATCH /todos/:id` · `DELETE /todos/:id` (PATCH not PUT, unversioned); list ordering server-side `ORDER BY created_at DESC, id DESC`, client never re-sorts, optimistic-add prepends.
- AR14 (Conventions): Structured logging in `api`; a React error boundary in `web`; no unhandled error reaches the user. Rely on React default output-escaping for XSS on render.
- AR15 (Conventions/Tooling): Quality gate committed + CI-checkable — `eslint` + `prettier` in `web`, `gofmt` + `golangci-lint` in `api`.
- AR16 (Stack, verified Jul 2026): Next.js 16.2 LTS · TanStack Query 5.x · Go 1.26 · Gin 1.12 · golang-migrate 4.x · PostgreSQL 18 · Docker Compose (current).

### UX Design Requirements

_Visual identity from DESIGN.md; behavior/IA/flow/voice/accessibility from EXPERIENCE.md. The UX spine wins over the mockups on conflict; mockups only illustrate._

**Design foundations (tokens)**

- UX-DR1: Implement the Cream & Terracotta color token set — light (default) and a first-class warm-dark (warm charcoal, never blue-black) theme — all tokens per DESIGN.md (`surface-*`, `ink-*`, `accent`, `accent-soft`, `border-hairline`, `on-accent`, and their `-dark` variants). The single terracotta accent is used for action/payoff only and never for alarm.
- UX-DR2: Implement the typography system — one rounded humanist sans family (`ui-rounded`/SF Pro Rounded → Nunito/Quicksand fallback) and the type scale (`wordmark` 26/23px·800, `empty-headline` 19px·700, `task-title` 17px·500, `input` 16px·400, `description` 14px·400, `meta` 13px·400); weight (not size) carries row-level hierarchy.
- UX-DR3: Implement the layout primitives — 4px spacing scale (4/8/12/16/24/32), rounding tokens (`sm`10 / `md`13 / `lg`16 / `full`9999px, checkbox a true circle), and soft warm low elevation (row `0 2px 6px -3px rgba(90,60,35,.22)`; toast deep-soft; completed rows shed elevation; dark deepens shadows).

**Components (visual spec in DESIGN.md · behavior in EXPERIENCE.md)**

- UX-DR4: Wordmark — lowercase "todo" + a terracotta accent dot, top-left header. No icon/lockup.
- UX-DR5: Add-input — raised field pinned top of the list, focused on load and re-focused after every add; focused resting state (1.5px accent border + accent-soft ring); pill "Add" button as equal alternative to Enter; placeholder "Add a task…".
- UX-DR6: Char counter — `meta`-size, right-aligned under the input; hidden until approaching a cap (title 200 / description 2000), number turns accent + bold near the limit.
- UX-DR7: Task row (active) — raised card; circular empty checkbox; title (primary), optional description line, relative timestamp; description clamps to ~2 lines with soft fade + inline "more" reveal; single-line rows center vertically, described rows top-align.
- UX-DR8: Task row (completed) — the payoff state, rendered settled: transparent bg/border, shadow removed, row recedes (~0.85 opacity); filled terracotta checkbox with white check; title strikethrough + muted; meta muted.
- UX-DR9: Inline edit-in-place — the row itself becomes the editor (accent border + accent-soft ring), title field (selection highlighted) + optional description field (dashed hairline separator, placeholder "Add a description (optional)") + hint line "Enter to save · Esc to cancel". No modal, no route change.
- UX-DR10: Delete affordance — a quiet ✕ icon button, low-key `ink-secondary` at rest, surfacing on row hover (accent-soft fill + accent glyph on hover). Never a loud red trash button.
- UX-DR11: Undo toast — fully-rounded pill floating bottom-center on `surface-raised` with deep-soft shadow; message "Task deleted" + pill "Undo" action; non-blocking, transient (~5s), overlaps the list without displacing it.
- UX-DR12: Theme toggle — ghost icon button in header (sun in light / moon in dark); real and functional in v1; preference persists across sessions/devices as feasible.
- UX-DR13: Placeholder avatar — quiet circular mark right of the theme toggle; **non-functional in v1** (no accounts), a forward gesture toward multi-user; must not be wired to anything.
- UX-DR14: Skeleton loading rows — match row anatomy (circular check placeholder + 1–2 shimmer lines) with an accent-soft-tinted shimmer sweep and a "Getting your tasks…" note; never a blank screen or bare spinner; resolve directly to content.
- UX-DR15: Empty state — centered soft accent-soft glyph field with a line-art check-in-circle, headline "Nothing here yet", subline "Add your first task above — it'll show up right here."; the focused add-input remains the focal CTA above it.
- UX-DR16: Error state — same centered structure, de-escalated (neutral `border-hairline` glyph field, `ink-secondary` refresh glyph, no red); headline "Couldn't load your tasks", warm subline, and a solid accent "Try again" button (the one place the filled primary button appears) that re-issues the failed request.

**Layout & responsiveness**

- UX-DR17: Single centered column (`max-width ≈560px` desktop; full-width with ~18px side padding on mobile), same composition at every width, functional and polished from ~375px up. Header (wordmark left; theme toggle + placeholder avatar right) → pinned add-input → newest-first list; undo toast floats bottom-center; char counter right-aligned under the input.

**Interaction primitives**

- UX-DR18: Optimistic UI is the baseline — every mutating action renders ≤100ms; motion decorates the change and never blocks/gates the optimistic render (perf floor wins over animation).
- UX-DR19: "Pops to top" on add — a newly added task animates in at the top, directly below the add input.
- UX-DR20: Satisfying, bouncy check-off — completing uses a spring with a visible settle into the completed style (the app's primary emotional payoff, deliberately more expressive than any other motion); toggling back is the same motion reversed.
- UX-DR21: Undo window (~5s) — delete → pending-delete → toast; Undo requires no server round-trip and restores in place instantly; window elapse commits; closing/reloading while pending commits (via sendBeacon, AR5).
- UX-DR22: Keyboard is inherent to the core loop — Enter submits an add and saves an edit; Esc cancels/reverts an edit; the add input stays focused so a user can type-Enter-type-Enter without the mouse.
- UX-DR23: Progressive char-count feedback — title 200 / description 2000, feedback appears as the limit is approached and escalates as exceeded; never present at rest.
- UX-DR24: No drag-to-reorder, swipe, or long-press in v1 (ordering fixed newest-first).

**Voice & microcopy**

- UX-DR25: Lock the confirmed microcopy strings exactly — wordmark "todo"; placeholder "Add a task…"; empty "Nothing here yet" / "Add your first task above — it'll show up right here."; loading "Getting your tasks…"; error "Couldn't load your tasks" / "Something got in the way. Your tasks are safe — let's try that again." / button "Try again"; edit hint "Enter to save · Esc to cancel"; description placeholder "Add a description (optional)"; undo "Task deleted" + "Undo".
- UX-DR26: Voice/tone — warm, friendly, restrained, reassuring; never alarming or marketing-loud; errors reassure before they explain; lowercase plain complete sentences; no jargon/status-codes/streaks/badges/emoji.

**Accessibility floor (v1 respects; full coverage deferred)**

- UX-DR27: Respect the v1 a11y floor — keyboard for the core path (Enter/Esc + persistent focus), a visible accent focus ring, semantic controls (real button/checkbox/input, not click-handlers on generic elements), and legible warm contrast intent in both themes.
- UX-DR28: Explicitly deferred to future hardening (flag, do not pretend done) — full screen-reader label/role/state coverage (incl. `aria-live` for completion/pending-delete/undo), comprehensive keyboard traversal of every affordance + focus-order guarantees, verified WCAG ratios, and `prefers-reduced-motion` handling (bouncy check-off / pop-to-top → instant). `prefers-reduced-motion` decision is an OPEN QUESTION (see SPEC.md).

### FR Coverage Map

FR1: Epic 1 — Create a todo (title required + optional description, Enter/Add submit)
FR2: Epic 1 — New todo appears optimistically with status/timestamps
FR3: Epic 1 — Empty/whitespace title rejected inline, no todo created
FR4: Epic 1 — Input clears + stays focused after a successful add
FR5: Epic 1 — Full list loads/displays automatically on open
FR6: Epic 1 — Each todo shows title, description, status, relative time
FR7: Epic 2 — Completed todos rendered visually distinct (ships with the toggle)
FR8: Epic 1 — List ordered newest-first
FR9: Epic 2 — Edit title + description in place
FR10: Epic 2 — Edits save on Enter/blur (optimistic + persisted); Esc reverts
FR11: Epic 2 — Empty-title edit rejected + reverts; description may be cleared
FR12: Epic 2 — Toggle status active/completed instantly + persisted
FR13: Epic 2 — Delete → optimistic removal → pending-delete (not committed)
FR14: Epic 2 — ~5s Undo toast restores in place, no round-trip
FR15: Epic 2 — Window elapse commits; close/reload while pending = committed
FR16: Epic 1 — REST CRUD API (create, list, update, delete)
FR17: Epic 1 — Durable persistence across restarts + sessions
FR18: Epic 1 — Appropriate HTTP codes + structured error responses
FR19: Epic 1 — Record shape + extensible status enum + system timestamps
FR20: Epic 1 (minimal, bare prompt) + Epic 3 (polished illustration)
FR21: Epic 1 (minimal, basic indicator) + Epic 3 (skeleton shimmer rows)
FR22: Epic 1 (minimal, basic fetch-error) + Epic 3 (warm illustration + unified AD-9 error split)
FR23: Epic 1 (add-path rollback — integral to optimistic add, CM2) + Epic 3 (systematized across all four mutations)
FR24: Epic 3 — Char-limit feedback UI (caps enforced server-side from Epic 1 per AR10)

**Resilience-floor split rationale (from advanced elicitation):** Optimistic add ships in Epic 1 (FR2), so add-path rollback (FR23) plus a minimal empty/loading/error floor (FR20–FR22) must ship *with* Epic 1 — otherwise a failed POST leaves a phantom todo (violates CM2) or the first `docker compose up` shows a blank screen (violates NFR2). Epic 3 owns the *polished + systematized* layer: skeleton shimmer, the warm error illustration, the unified AD-9 error-contract handling applied across all four mutations, and the progressive char-counter UI.

## Epic List

### Epic 1: Foundation & Task Capture
A user can open the app, add tasks, and see their persistent list — the running, deployable walking skeleton of todo, honest enough to demo without embarrassment. Establishes the greenfield monorepo (`web` + `api` + `db`), the fixed wire contract, the design-token system (light **and** warm-dark values as CSS variables), migrations-on-boot, and one-command `docker compose up`, then delivers the create + view happy path optimistically against a durable PostgreSQL store. Includes a **minimal resilience floor** — optimistic add-rollback, a basic loading indicator, a bare empty state, and basic fetch-error handling — so a failed POST never leaves a phantom todo (CM2) and the first load is never a blank screen (NFR2). No starter template exists, so the foundation is scaffolded from scratch and proves compose-up end-to-end. *(Story-step note: split the foundation across ~3 stories — infra walking-skeleton → create end-to-end → view/list rendering — so each fits a single dev-agent context.)*
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR8, FR16, FR17, FR18, FR19; FR20–FR23 (minimal floor only — polished versions in Epic 3)
**Anchors:** AR1–AR16 (foundation: layered backend, repo seam, dumb proxy, wire contract, server-authoritative id/timestamps, migrations, deploy envelope, conventions, stack, quality gate) · NFR1 (optimistic add), NFR2, NFR3, NFR4, NFR6, NFR7, NFR11 · UX-DR1–3 (token system incl. dark values as CSS variables), UX-DR4, UX-DR5, UX-DR7, UX-DR15 (bare empty), UX-DR17, UX-DR18, UX-DR19, UX-DR22
**⚠️ Prerequisite:** Resolve the SPEC open question on **testing conventions** (framework, coverage, unit/integration/e2e split) *before* Epic 1 development begins — it gates NFR6 and the quality gate (AR15), and is not a parallel track.
**Test-design tasks (from risk review 2026-07-17):** the infra walking-skeleton story must also scaffold (a) the `GET /health` readiness route [TC5] and (b) a test-only seed/reset seam in the repository [TC1] — both pre-implementation enablers that unblock integration/E2E; add a named-volume durability check (data survives `compose down`+`up`) [R6]. The create-end-to-end story introduces the **shared wire-contract type** that `web` and `api` both derive from [R3/AD-6 enforcement rule] before the client consumes it.

### Epic 2: Complete the Task Loop
A user can fully manage tasks — edit title and description in place, toggle completion with the satisfying bouncy settle, and delete with a ~5s undo window — turning capture into a complete task manager. Builds directly on Epic 1's mutations, wire contract, and list.
**FRs covered:** FR7, FR9, FR10, FR11, FR12, FR13, FR14, FR15
**Anchors:** AR4 (TanStack mutations), AR5 (client pending-delete + sendBeacon), AR6 (PATCH partial, 204/404-as-success), AR8 (status enum toggle), AR10 (edit validation) · UX-DR8 (completed row), UX-DR9 (inline edit), UX-DR10 (delete ✕), UX-DR11 (undo toast), UX-DR20 (bouncy check-off), UX-DR21 (undo window), UX-DR22 (keyboard save/cancel)
**Test-design tasks (from risk review 2026-07-17):** edit / toggle / delete reuse the **shared optimistic-mutation wrapper** (see Epic 3 / R1) rather than hand-rolling rollback per story; the pending-delete ~5s timer must be a controllable/injectable clock so tests are deterministic [R9].

### Epic 3: Trustworthy, Polished Experience
The app feels finished and never hides a failure — upgrading Epic 1's minimal resilience floor to the *polished + systematized* layer: skeleton shimmer loading rows, the warm error-state illustration with retry, the unified AD-9 error-contract handling applied across **all four** mutations (systematized optimistic rollback), progressive char-limit feedback, the real warm-dark theme **toggle** (on top of the token system built in Epic 1), responsive polish from ~375px up, and the v1 accessibility floor. The portfolio-grade layer on top of the working loop.
**FRs covered:** FR20, FR21, FR22, FR23 (polished/systematized — minimal floor already in Epic 1), FR24
**Anchors:** AR3 (proxy error synthesis), AR9 (uniform error contract + client 4xx/5xx split), AR14 (React error boundary + structured logging) · NFR2, NFR4, NFR5, NFR9, NFR10 · UX-DR6 (char counter), UX-DR12 (theme toggle — consumes Epic 1 tokens), UX-DR13 (placeholder avatar), UX-DR14 (skeleton shimmer), UX-DR16 (error illustration), UX-DR23 (char feedback), UX-DR24 (no gestures), UX-DR26 (voice), UX-DR27 + UX-DR28 (a11y floor + deferred)
**Test-design tasks (from risk review 2026-07-17):** the systematized optimistic-rollback story is the **top risk (R1, re-scored 9)** — elevate to **P0 must-pass** with acceptance criteria: (1) every mutating action (add/edit/toggle/delete) rolls back **visibly** on server rejection; (2) a post-rollback refetch equals server truth — **no silent divergence** (CM2); (3) implemented via **one reusable optimistic-mutation wrapper** (`onMutate` snapshot + `onError` restore) shared by all four paths, not four hand-rolled rollbacks. Gate any `prefers-reduced-motion` scenario on PRD **OQ3**.

### Epic 4: Continuous Integration & Quality Gate
Every push and pull request is automatically verified by a GitHub Actions pipeline that runs the committed quality gate and the full test suite — operationalizing the "CI-checkable" quality gate (AR15/NFR6) and the spine's `GET /health`-driven CI E2E gating. A fast lane (lint/format + unit tests) gives quick signal; a health-gated integration/E2E lane runs the api integration tests and Playwright E2E against the `docker-compose.test.yml` (testseed) stack. Triggered on pull_request and on push to `main`; a red pipeline blocks merge. No product code changes — this wires existing, already-passing scripts into automation and makes green CI the precondition for every future story in Epics 2 and 3.
**FRs covered:** none (infrastructure/quality epic) — enforces NFR6
**Anchors:** AR15 (eslint+prettier / gofmt+golangci-lint, CI-checkable) · NFR6 (clean, linted, passing) · GET /health CI E2E gating (spine) · reuses docker-compose.test.yml [TC1 reset seam] and GET /health [TC5]
**Priority note:** Sequenced to run NEXT (before Epic 2 dev resumes) so the regression net exists before more mutation paths (Epics 2–3) are built.

## Epic 1: Foundation & Task Capture

A running, demoable walking skeleton — greenfield monorepo scaffold, fixed wire contract, design-token system (light + warm-dark values), migrations-on-boot, and one-command `docker compose up` — then create + view optimistically against durable PostgreSQL, with a minimal resilience floor (add-path rollback, basic loading/empty/error) so Epic 1 is honestly usable.

### Story 1.1: Project skeleton & one-command startup

As a reviewer/developer,
I want to clone the repo and bring the whole stack up with one command,
So that I can run and evaluate the app in minutes with no manual setup.

**Acceptance Criteria:**

**Given** a clean clone
**When** I run `docker compose up`
**Then** `web`, `api`, and `db` all start healthcheck-gated (`db` healthy → `api` migrates then serves → `web`)
**And** only `web` exposes a host port (`api`/`db` internal-only), and `db` uses a named volume

**Given** the stack is up
**When** the browser loads `web`
**Then** it calls `GET /api/todos` same-origin, the dumb proxy forwards to `api` verbatim, and `api` returns a bare `[]` (never `null`)
**And** the UI renders the bare empty state ("Nothing here yet") — never a blank screen

**Given** the `api` boots
**When** it starts
**Then** versioned `golang-migrate` migrations run automatically before it serves
**And** create the `todos` table (`id` uuid PK, `title` text, `description` text, `status` text + CHECK `active|completed`, `created_at`/`updated_at` timestamptz)

**Given** the repo
**When** a new developer follows the README
**Then** clone→install→run completes in ≤10 minutes with no undocumented steps
**And** `.env.example` documents all config with working defaults, no secrets are committed, and lint/format configs (`eslint`+`prettier` in `web`, `gofmt`+`golangci-lint` in `api`) are committed and pass

**Given** the design system
**When** the app renders
**Then** the Cream & Terracotta token set — light and warm-dark values — is defined as CSS variables from day one (the theme toggle itself is deferred to Epic 3)

### Story 1.2: Create a todo (optimistic, end-to-end)

As a user,
I want to type a title and hit Enter to add a task that instantly appears at the top,
So that I can dump tasks as fast as I think of them.

**Acceptance Criteria:**

**Given** the pinned, focused add-input
**When** I type a valid title and press Enter (or click Add)
**Then** the todo is inserted optimistically at the top in ≤100ms with a temporary id
**And** the input clears and keeps focus for rapid entry

**Given** an optimistic add
**When** `POST /todos` returns `201` with the full resource
**Then** the client swaps the temp id for the server-generated UUID
**And** the row reflects server-set `status=active` and timestamps (camelCase wire shape, timestamps nested under `metadata`)

**Given** an empty or whitespace-only title
**When** I submit
**Then** it is rejected inline within the same interaction, no row is created, and focus is retained
**And** no request is sent to the server

**Given** the server as the authoritative validator
**When** a create is validated
**Then** `title` is required and ≤200 code points and `description` is optional and ≤2000, with whitespace trimmed before validation on both client and server (cap applied after trim)
**And** a title of exactly 200 code points is accepted while 201 is rejected (boundary inclusive), counting by Unicode code point (a multi-code-point grapheme counts as more than one)
**And** a server-side validation failure returns `{ error: { code: "validation_error", message } }` with HTTP `400`
**And** the server assigns `id`/`status`/timestamps and ignores any client-supplied `id`/`status`/`metadata`

**Given** the add-input
**When** I submit the same input twice in rapid succession (e.g. Enter pressed twice)
**Then** exactly the intended number of todos is created (the optimistic add is guarded against an accidental double-add)

**Given** an optimistic add
**When** the server rejects it (5xx/network/timeout)
**Then** the phantom row rolls back visibly (add-path rollback)
**And** there is no silent divergence between what is shown and what is persisted

### Story 1.3: View the persistent task list

As a user,
I want my existing tasks to load automatically whenever I open the app, newest-first with readable detail,
So that my list is always there and trustworthy.

**Acceptance Criteria:**

**Given** existing todos
**When** I open the app
**Then** the full list loads automatically with no action required, ordered newest-first (`created_at DESC, id DESC`)
**And** the client never re-sorts the server order
**And** two todos created within the same one-second timestamp order deterministically by `id DESC` (tiebreak, since timestamps are second-precision)

**Given** a todo in the list
**When** it renders
**Then** it shows the title, the optional description (clamped to ~2 lines with a soft fade + "more" reveal), the status, and a relative creation time ("2 hours ago")

**Given** a todo whose description is clamped
**When** I tap "more"
**Then** the full description expands in place (it does not enter edit mode)

**Given** the list is fetching
**When** it is loading
**Then** a basic loading indicator is shown (never a blank screen)
**And** when the fetch fails, a basic non-disruptive error with a retry that re-issues the request is shown

**Given** I add tasks then refresh or reopen in a new session (or restart the server)
**When** the app loads
**Then** all todos persist and reappear consistently, with no data loss and no stale reads

## Epic 2: Complete the Task Loop

Turn capture into full task management — complete, edit, and delete-with-undo — building directly on Epic 1's mutations, wire contract, and list.

### Story 2.1: Complete a task (toggle with the payoff)

As a user,
I want to check a task off and watch it settle into a "done" style,
So that closing a loop feels satisfying.

**Acceptance Criteria:**

**Given** an active todo
**When** I tap its checkbox
**Then** it toggles to `completed` optimistically (≤100ms) and persists via `PATCH /todos/:id` with `{ status }`
**And** tapping again returns it to `active`

**Given** a todo becomes completed
**When** it settles
**Then** it renders visually distinct — filled terracotta check, strikethrough + muted title, recessed (transparent background, no shadow)
**And** the transition uses a satisfying bouncy spring settle (the app's primary payoff motion)

**Given** the ≤100ms performance floor
**When** completing
**Then** motion decorates the change but never gates or blocks the optimistic state change

**Given** the server rejects the toggle
**When** it fails (5xx/network/timeout)
**Then** the toggle rolls back visibly to its prior state

### Story 2.2: Edit a task in place

As a user,
I want to tap a task and fix its title or description right in the row,
So that corrections happen where the task lives — no modal, no navigation.

**Acceptance Criteria:**

**Given** a todo
**When** I tap its title or description
**Then** the row itself becomes an inline editor (title field + optional description field + hint "Enter to save · Esc to cancel")

**Given** the inline editor
**When** I confirm with Enter or blur
**Then** the change is applied optimistically and persisted via `PATCH /todos/:id` sending only the changed fields (an absent field means unchanged, never a zero-value overwrite)
**And** pressing Esc cancels and reverts to the prior values

**Given** the inline editor was opened but nothing changed
**When** I confirm (Enter or blur)
**Then** no `PATCH` request is issued (a no-op edit is not a write)

**Given** an edit that leaves the title empty or whitespace-only
**When** I save
**Then** it is rejected and reverts to the prior title (title required)
**And** clearing the description is accepted and persisted by sending `description: ""` explicitly (an intentional change, not an omitted/unchanged field)

**Given** the server rejects an edit
**When** it fails
**Then** the row rolls back visibly to its pre-edit values

### Story 2.3: Delete a task with undo

As a user,
I want a deleted task to disappear immediately but be recoverable for a few seconds,
So that a misclick is never destructive.

**Acceptance Criteria:**

**Given** a todo
**When** I activate its quiet delete affordance
**Then** the row is removed from the visible list immediately (optimistic) and enters a client-side pending-delete state with no network call
**And** an Undo toast appears bottom-center for ~5 seconds

**Given** a pending delete
**When** I tap Undo within the window
**Then** the todo is restored in place instantly with no server round-trip and no data loss

**Given** a pending delete
**When** the ~5s window elapses without Undo
**Then** the real `DELETE /todos/:id` fires, treating a `204` (or a `404` "already gone") as success

**Given** an Undo tap that races the window boundary
**When** it lands before the `DELETE` request is dispatched
**Then** Undo wins and cancels the deletion; once the `DELETE` has been dispatched the deletion is committed and Undo no longer applies

**Given** a pending delete
**When** I close or reload the tab before the window elapses
**Then** the delete is flushed via `navigator.sendBeacon` / `fetch keepalive` and treated as committed — the todo does not reappear

## Epic 3: Trustworthy, Polished Experience

Make it feel finished and never hide a failure — upgrade Epic 1's minimal resilience floor to the polished + systematized layer, add the warm-dark theme toggle, progressive char feedback, responsive polish, and the v1 accessibility floor.

### Story 3.1: Unified error contract & systematized rollback

As a user,
I want every action to fail safely and predictably,
So that I'm never shown a lie about what's saved.

**Acceptance Criteria:**

**Given** any non-2xx response from `api`
**When** it returns
**Then** it uses the uniform `{ error: { code, message } }` shape with a fixed code vocabulary (`validation_error` 400, `not_found` 404, `internal_error` 500)

**Given** `api` is unreachable or exceeds the proxy timeout
**When** the proxy cannot reach it
**Then** the proxy synthesizes an AD-9-shaped `502`/`504` error — never an HTML error page or a thrown fetch to the browser

**Given** a failed mutation
**When** it is a `4xx` validation error
**Then** the client shows inline feedback with no retry
**And** when it is `5xx`/network/timeout, the client shows the error state with a retry path

**Given** all four mutations (add/edit/toggle/delete)
**When** any is rejected
**Then** optimistic rollback is applied uniformly across them
**And** a React error boundary plus structured `api` logging ensure no unhandled error reaches the user

### Story 3.2: Polished loading, empty & error states

As a user,
I want the waiting and failure moments to feel calm and intentional,
So that the app feels finished even when things go wrong.

**Acceptance Criteria:**

**Given** the initial list fetch
**When** loading
**Then** skeleton shimmer rows matching row anatomy show with a "Getting your tasks…" note (never a blank screen, never a bare spinner), resolving directly to content

**Given** no todos exist
**When** the list is empty
**Then** the polished empty state shows (accent-soft glyph field, "Nothing here yet", subline "Add your first task above — it'll show up right here.") with the focused add-input as the CTA

**Given** a load failure
**When** the error is shown
**Then** the de-escalated warm error state appears (neutral glyph, no red) with "Couldn't load your tasks", a reassuring subline, and a solid accent "Try again" button that re-issues the request

### Story 3.3: Progressive character-limit feedback

As a user,
I want to see how close I am to a length limit only when it matters,
So that I'm guided without clutter.

**Acceptance Criteria:**

**Given** the add-input or an inline edit field
**When** the text approaches its cap (title 200 / description 2000)
**Then** a quiet `meta`-size counter appears (hidden at rest)

**Given** the counter is shown
**When** the value nears or exceeds the cap
**Then** the number turns accent and bold and escalates
**And** the cap is counted in Unicode code points, consistent with server-side validation

### Story 3.4: Warm-dark theme toggle

As a user,
I want a real warm-dark mode I can switch to,
So that the app is comfortable in low light.

**Acceptance Criteria:**

**Given** the header
**When** I use the theme toggle (sun icon in light / moon icon in dark)
**Then** the app switches between light (default) and the warm-charcoal dark theme by swapping the Epic 1 CSS-variable tokens — never a cold blue-black

**Given** I set a theme
**When** I reload or return in a later session
**Then** the preference persists

**Given** the header
**When** it renders
**Then** the placeholder avatar is present but non-functional (no login wired, nothing happens on tap) — a forward gesture toward future multi-user only

### Story 3.5: Responsive polish, voice & accessibility floor

As a user on any device,
I want a polished, keyboard-friendly experience with locked, warm copy,
So that the app feels trustworthy and consistent everywhere.

**Acceptance Criteria:**

**Given** widths from ~375px up through desktop
**When** I use the app
**Then** the single centered column (max ~560px) is fully functional and polished, with no layout reflow and no horizontal scroll

**Given** the core loop
**When** I use the keyboard
**Then** Enter submits an add and saves an edit, Esc cancels/reverts, the add-input stays focused, controls show a visible accent focus ring, and controls are semantic (real button/checkbox/input)
**And** no drag-to-reorder, swipe, or long-press gesture exists

**Given** all user-facing text
**When** it renders
**Then** the locked microcopy strings are used verbatim and the voice stays warm/restrained/reassuring (no alarm-red, no jargon/status-codes/streaks/badges)

**Given** the deferred accessibility scope
**When** the v1 floor ships
**Then** deferred items (full screen-reader labeling, `aria-live` for completion/pending-delete/undo, complete keyboard traversal + focus-order, verified WCAG ratios, `prefers-reduced-motion` handling) are documented as future hardening — flagged, not pretended done

## Epic 4: Continuous Integration & Quality Gate

Automate the already-committed quality gate and test suite on GitHub Actions so every pull request and every push to main is verified without manual steps — a green pipeline becomes the precondition for merge. Reuses existing scripts and the test compose profile verbatim; introduces no new test infrastructure and no product code change.

### Story 4.1: CI fast lane — quality gate + unit tests

As a developer,
I want lint/format and unit tests to run automatically on every PR and push to main,
So that style regressions and broken units are caught in minutes, before review.

**Acceptance Criteria:**

**Given** a pull request or a push to `main`
**When** the pipeline runs
**Then** a GitHub Actions workflow at `.github/workflows/ci.yml` triggers on `pull_request` and on `push` to `main`

**Given** the fast-lane job
**When** it runs the quality gate
**Then** it runs, and fails on any violation of: `eslint` + `prettier --check` in `web` and `gofmt` (diff check) + `golangci-lint` in `api` (AR15/NFR6)

**Given** the fast-lane job
**When** it runs unit tests
**Then** `web` Vitest (`npm run test:unit`) and `api` Go unit tests (`go test ./...`) both run and must pass; a non-zero exit fails the job

**Given** dependency setup
**When** the job initializes
**Then** Node and Go toolchains match the project versions (Node for Next.js 16.2, Go 1.26) and dependency caching is enabled for reasonable run times

**Given** any step fails
**When** the workflow completes
**Then** the overall check is reported red on the PR/commit (the merge signal is honest)

### Story 4.2: CI integration & E2E lane (health-gated)

As a developer,
I want the api integration tests and the Playwright E2E suite to run against the real Dockerized stack in CI,
So that cross-unit regressions (wire contract, optimistic flows) are caught automatically.

**Acceptance Criteria:**

**Given** the integration/E2E job
**When** it starts the stack
**Then** it brings up the app via `docker compose -f docker-compose.yml -f docker-compose.test.yml up --build` (the testseed profile compiles the `/internal/test/reset` seam, per TC1)

**Given** the stack is starting
**When** the job waits for readiness
**Then** it gates on `GET /health` reporting migrated + serving before any test runs (no fixed sleeps; per the spine's CI E2E gating [TC5]) with a bounded timeout

**Given** a ready stack
**When** the job runs tests
**Then** the `api` integration tests and the Playwright E2E suite (`npm run test:e2e`, at minimum the `@p0` set via `test:e2e:p0`) run and must pass

**Given** the run finishes (pass or fail)
**When** the job tears down
**Then** the compose stack is stopped/cleaned up, and on failure the Playwright report / relevant logs are uploaded as workflow artifacts for debugging

**Given** either the fast lane or this lane is red
**When** the pipeline aggregates
**Then** the combined CI status is red (both lanes must be green to pass)

### Story 4.3: Merge protection, status surface & docs

As a maintainer,
I want CI to be the enforced gate for merging and its status visible in the README,
So that no unverified change reaches main and contributors know the workflow.

**Acceptance Criteria:**

**Given** the repository
**When** CI is established
**Then** the required status checks for merging into `main` are documented (branch-protection settings: PRs must be green to merge) in the README/CONTRIBUTING note

**Given** the README
**When** a reader opens it
**Then** a CI status badge for the workflow is shown and a short "Continuous Integration" section explains what runs on push/PR and how to run the same checks locally (the exact `npm run` / `go test` / compose commands CI uses)

**Given** NFR7 (clone→run ≤10 min, no undocumented steps)
**When** a new developer reads the docs
**Then** the CI story adds no manual local setup step — the documented local commands are the same ones CI invokes, keeping local and CI behavior consistent
