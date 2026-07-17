---
id: SPEC-todo-app
companions:
  - ../../planning-artifacts/prds/prd-todo-app-2026-07-17/prd.md
  - ../../planning-artifacts/prds/prd-todo-app-2026-07-17/addendum.md
  - ../../planning-artifacts/ux-designs/ux-todo-app-2026-07-17/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-todo-app-2026-07-17/EXPERIENCE.md
  - ../../planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. The kernel below carries capability-level intent and the decision-bending constraints; the companions hold the load-bearing detail each constraint cites — functional requirements (`prd.md`), stack rationale (`addendum.md`), visual identity (`DESIGN.md`), behavior/IA/flow (`EXPERIENCE.md`), and the architecture invariants AD-1…AD-12 (`ARCHITECTURE-SPINE.md`). Consult a companion when you need the full rule; the constraint here names it.

# Todo App

## Why

A **vision to realize**, doubling as an **opportunity to capture**. This is a deliberately minimal, single-user todo web app for anyone who wants a dead-simple task list with no signup, no accounts, and no clutter — open it and it just works. The product's value *is* its restraint: it runs the core loop (create, view, edit, complete, delete) so cleanly and reliably that a small surface feels like a complete, polished product. It serves two audiences at once — the person clearing their head between meetings, and a portfolio reviewer evaluating full-stack engineering quality. It matters now as a demonstration that a conventional, well-structured foundation can feel finished today and grow toward auth/multi-user later without a rewrite. Every downstream trade-off resolves against that pairing: *calm restraint for the user, legible clean engineering for the reviewer.*

## Capabilities

- **CAP-1 — Task Capture (Create)**
  - **intent:** A user can create a todo by entering a required title (and an optional description) and submitting via the Enter key or an Add button.
  - **success:** A valid title inserts the todo optimistically at the top of the list (≤100ms), the input clears and keeps focus for rapid entry; an empty or whitespace-only title is rejected inline within the same interaction and no row is created.

- **CAP-2 — Task List (View)**
  - **intent:** A user can view their full todo list automatically on opening the app — each item showing title, optional description, status, and a relative creation time, newest-first.
  - **success:** On open, the list loads and renders ordered `created_at DESC, id DESC` with no action required; completed items are visually distinct from active ones.

- **CAP-3 — Task Editing**
  - **intent:** A user can edit a todo's title and description in place within the row (no modal, no route change).
  - **success:** Confirming with Enter or blur saves optimistically and persists; Esc reverts; an edit leaving the title empty/whitespace reverts to the prior title, while clearing the description is accepted (it is optional).

- **CAP-4 — Task Completion**
  - **intent:** A user can toggle a todo between `active` and `completed`.
  - **success:** The toggle reflects instantly (optimistic) and persists; the completed state renders visually settled (strikethrough + muted, recessed).

- **CAP-5 — Deletion with Undo**
  - **intent:** A user can delete a todo with a client-side undo window before the deletion is committed to the backend.
  - **success:** Delete removes the row immediately and shows an Undo toast for ~5s with no server round-trip; Undo restores the todo in place; on window elapse — or on tab close/reload while pending — the `DELETE` commits and the todo does not reappear.

- **CAP-6 — Persistence & API**
  - **intent:** The system persists todos durably behind a small REST CRUD API over the fixed wire contract.
  - **success:** Todos survive server restarts and browser sessions with zero data loss; the API returns the fixed camelCase resource shape with appropriate HTTP status codes; each record carries `id`, `title`, `description`, `status` (enum), `createdAt`, `updatedAt`.

- **CAP-7 — Resilience & Feedback**
  - **intent:** The app surfaces first-class empty, loading, and error states and visibly rolls back any optimistic action the server rejects.
  - **success:** Empty shows a friendly prompt; loading shows skeleton rows (never a blank screen or bare spinner); a failed call shows a non-disruptive warm error with a working Retry that re-issues the request; a rejected mutation rolls back to the exact pre-action state.

## Constraints

- **No accounts, signup, onboarding, or configuration in v1** — the app opens straight into the working list. Cross-device continuity is one shared backend list, not per-user sync. (CM3)
- **Optimistic UI is the baseline** — every mutating action renders ≤100ms and motion never gates the render; API p95 ≤300ms under single-user load. (NFR1/SM3)
- **Optimistic actions roll back visibly on server rejection** — never a silent divergence between what the user sees and what is persisted. (CM2/FR23)
- **Layered client–server, one-way dependency** — a dumb Next.js BFF proxy → Gin `handler → service → repository` → PostgreSQL; Gin is the sole owner of business rules and validation; the proxy forwards verbatim and there is no CORS. (`ARCHITECTURE-SPINE.md` AD-1, AD-3)
- **The repository interface is the multi-user seam** — data model and API are structured so user-scoping can be added without a rewrite, but it is *not* built in v1. (AD-2, NFR8)
- **The `web ↔ api` wire contract is fixed** — camelCase; timestamps nested under `metadata`; `description` is empty-string never `null`; `GET /todos` returns a bare array (`[]` never `null`); `id` (UUID v4) and timestamps (RFC3339 UTC `Z`) are server-authoritative; `PATCH` is partial. (AD-6, AD-7)
- **`status` is an extensible text enum** — Postgres `text` + `CHECK` (current values `active` | `completed`); new states are added by editing the list, never a schema migration. (AD-8, FR19)
- **Validation is server-authoritative, mirrored client-side** (never client-only) — `title` required ≤200 code points, `description` optional ≤2000; whitespace trimmed before validation on both sides. (AD-10, FR24, NFR10)
- **One uniform error contract** — `{ "error": { "code", "message" } }` with a fixed code vocabulary; the client splits handling: `4xx` → inline feedback, no retry; `5xx`/network/timeout → error state + Retry. (AD-9)
- **Schema evolves only through versioned `golang-migrate` files** applied automatically on `api` boot; no manual schema steps. (AD-11)
- **The whole stack starts with a single `docker compose up`** — only `web` exposes a host port (`api` and `db` internal-only), `db` on a named volume, 12-factor env with working defaults, no secrets committed. (AD-12, NFR11)
- **Clone → run locally in ≤10 minutes** via the README with no undocumented steps; linter + formatter committed and CI-checkable. (SM5, NFR6, NFR7)
- **Fully functional and polished from ~375px mobile up through desktop**; light is the default with a first-class warm-dark theme toggle whose preference persists. (NFR5/SM4)
- **Visual identity is bespoke Cream & Terracotta** — a single terracotta accent used for action and payoff only, never for alarm; errors render in warm muted ink; generous rounding, low warm shadows. (`DESIGN.md`)

## Non-goals

- User accounts, authentication, multi-user, collaboration, and sharing.
- Task prioritization, manual reordering, deadlines/due dates, reminders/notifications.
- Categories, tags, projects, search/filtering, recurring tasks.
- Drag-to-reorder, swipe, and long-press gestures — ordering is fixed newest-first.
- Accessibility as a hard v1 commitment — deferred, not rejected (a minimal keyboard/focus/semantic floor is respected; full coverage is future hardening).

## Success signal

A first-time user, with no login and no setup, opens the app and completes all five core actions — create, view, edit, complete, and delete-with-undo — unaided; their tasks survive refresh, session, and a switch to another device with zero data loss; and a new developer clones the repository and has the full stack (frontend + backend + datastore) running via a single `docker compose up` in ≤10 minutes.

## Assumptions

- The numeric targets (≤100ms optimistic render, API p95 ≤300ms, ~5s undo window, ≤10-minute setup, 5/5 unaided test users) are chosen demo defaults, tunable during build/QA — not user-validated constants. (PRD `[ASSUMPTION]`)

## Open Questions

- Testing conventions — framework, coverage expectations, and the unit/integration/e2e split — are being defined by the user in a separate step and are not yet fixed (Architecture "Deferred"). Downstream test and dev work needs them resolved.
- `prefers-reduced-motion` handling for the bouncy check-off and pop-to-top is undecided (EXPERIENCE note) — flagged for future a11y hardening, not scoped for v1.
