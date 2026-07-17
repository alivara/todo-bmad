---
title: Todo App PRD
status: final
created: 2026-07-17
updated: 2026-07-17
---

# Todo App — Product Requirements Document

## 1. Overview

A deliberately minimal, single-user Todo app for anyone who wants a dead-simple task list
without signing up — open it and it just works: no onboarding, no accounts, no clutter.

The product's value *is* its restraint. It runs the core task-management loop — create, view,
edit, complete, delete — so cleanly and reliably that it feels like a complete, polished product
despite its small surface. As a portfolio piece it doubles as a demonstration of clean full-stack
engineering: a conventional, well-structured foundation that could grow into a multi-user product
without a rewrite.

**Primary user:** anyone who wants a no-signup, no-friction personal task list.
**Secondary audience:** a portfolio reviewer evaluating full-stack engineering quality.

## 2. Goals

- **G1 — Effortless core loop.** A first-time user completes every core action (create, view,
  edit, complete, delete) without any guidance.
- **G2 — Trustworthy persistence.** Todos survive refreshes and sessions reliably; no lost data,
  no stale state.
- **G3 — Instant-feeling UX.** Actions reflect immediately; the app is responsive and polished on
  desktop and mobile, with proper empty, loading, and error states.
- **G4 — Extensible foundation.** The architecture cleanly accommodates future auth / multi-user
  without a rewrite.
- **G5 — Engineering showcase.** Code is clean, understandable, easy to deploy and extend —
  legible enough to serve as a portfolio demonstration of full-stack quality.

## 3. Primary User Journey

_A single happy-path journey anchors the "polished feel" claim (G3) for downstream UX and story
work. It is intentionally the only journey — the surface is small enough that the FRs carry the
rest._

**UJ1 — Maya clears her head between meetings.** Maya has three minutes before her next call and a
head full of loose tasks. She opens the app on her phone; her existing list appears immediately (no
login, no spinner beyond a brief load). She types the title "Email Sam the Q3 numbers", hits enter,
and it pops to the top of the list; she taps to add a quick note in the description — "attach the
deck". She realizes she meant Q4, taps the title, edits it in place, and confirms. She checks off
"Book dentist" from yesterday — it visibly settles into the completed
style. She deletes a stale reminder; it vanishes, an "Undo" toast appears, and — realizing she
still needs it — she taps Undo and it returns. She locks her phone; nothing was lost. Later, on her
laptop, the same list is there, consistent.

## 4. Success Metrics

_Numeric targets below are chosen defaults for the demo, not user-validated constants — they are
tunable during build/QA._ `[ASSUMPTION]`

| # | Metric | Target | Goal |
|---|--------|--------|------|
| SM1 | First-time user completes all 5 core actions (create/view/edit/complete/delete) unaided | 5/5 test users succeed with **0 hints** | G1 |
| SM2 | Data survives refresh and new session | **0 data-loss events** across repeated refresh/reopen tests | G2 |
| SM3 | Actions feel instant | UI reflects change **≤100ms** (optimistic); API p95 **≤300ms** for a single sequential user (per-request smoke, not concurrent load) | G3 |
| SM4 | Works across devices | Passes functional + visual check at mobile (~375px) and desktop widths | G3 |
| SM5 | Clean, runnable engineering | New developer clones → runs locally in **≤10 min** via README; no undocumented steps | G5 |

**Counter-metrics** (guardrails against winning a metric the wrong way):

- **CM1 — No scope creep.** Nothing beyond the defined core scope ships in v1, even if easy to add.
- **CM2 — Instant-feel never hides errors.** Optimistic updates roll back visibly on server
  failure — no silent divergence between what the user sees and what is persisted. This is an
  **acceptance-level requirement**, not just a guardrail: every optimistic action must roll back
  visibly on failure and reconcile to server truth, verified end-to-end (highest-scored risk, R1).
- **CM3 — No configuration burden.** The user never has to configure anything to use the app.

## 5. Features & Functional Requirements

### Feature A — Task Capture (Create)

- **FR1** — User can create a todo by typing a short title (required) and submitting (Enter key or an "Add" button); an optional longer description can be added at creation or later.
- **FR2** — A new todo appears in the list immediately (optimistic), carrying its title, any description, `status = active`, and system-set `created_at` / `updated_at` timestamps.
- **FR3** — An empty or whitespace-only title is rejected; inline validation feedback appears within the same interaction and no todo is created. (Description is optional and may be blank.)
- **FR4** — After a successful add, the input clears and stays focused for rapid entry.

### Feature B — Task List (View)

- **FR5** — On opening the app, the full todo list loads and displays automatically — no action required.
- **FR6** — Each todo displays its title, its description (when present), its status, and a relative creation time (e.g., "2 hours ago").
- **FR7** — Todos with `status = completed` are visually distinct from `active` ones (e.g., strikethrough + muted styling).
- **FR8** — The list is ordered newest-first (most recently created at the top).

### Feature C — Task Editing

- **FR9** — User can edit a todo's title and its description in place via a clear affordance (e.g., click/tap the field or an edit control).
- **FR10** — Edits save on confirm (Enter or blur), applied optimistically and persisted; Esc cancels and reverts.
- **FR11** — An edit that leaves the title empty/whitespace-only is rejected and reverts to the prior title (title is required); the description may be cleared, since it is optional.

### Feature D — Task Completion (Toggle status)

- **FR12** — User can toggle a todo's `status` between `active` and `completed` via a clear control (checkbox/tap); the change reflects instantly (optimistic) and persists.

### Feature E — Task Deletion with Undo

- **FR13** — User can delete a todo via a clear affordance; it is removed from the visible list immediately (optimistic) and enters a *pending-delete* state that is **not yet committed** to the backend.
- **FR14** — During the pending-delete window (~5 seconds), an Undo toast is shown; activating Undo cancels the pending deletion and restores the todo in place, with no data loss and no server round-trip required.
- **FR15** — If the window elapses without Undo, the deletion is committed to the backend. If the app is closed or reloaded while a delete is pending, the deletion is treated as committed (the todo does not reappear) — closing the tab is confirmation, not cancellation.

### Feature F — Persistence & API (Backend)

- **FR16** — The backend exposes a small REST API supporting CRUD: create, list, update (title + description + status), and delete todos.
- **FR17** — Todo data persists durably in a datastore, surviving server restarts and browser sessions.
- **FR18** — The API returns appropriate HTTP status codes and structured error responses on failure.
- **FR19** — Each todo record carries: unique id, `title` (required), `description` (optional), `status`, `created_at`, and `updated_at`. `status` is a constrained enum — current allowed values `active` | `completed` — deliberately modeled to admit future states (e.g., `in_progress`, `archived`) without a schema rewrite. `created_at` and `updated_at` are system-managed timestamps, set on creation and refreshed on every modification; they are not user-editable.

### Feature G — Resilience & Feedback (cross-cutting UX states)

- **FR20** — Empty state: when no todos exist, show a friendly prompt to add the first one.
- **FR21** — Loading state: show a clear indicator while the list is fetching.
- **FR22** — Error state: when an API call fails, show a non-disruptive message with a retry path; activating retry re-issues the failed request.
- **FR23** — Optimistic actions (add/edit/toggle/delete) roll back visibly if the server rejects them, restoring the pre-action state.

### Cross-cutting input rule

- **FR24** — `title` is capped at 200 characters and `description` at 2000 characters, enforced both client- and server-side, with clear feedback as a limit is approached or exceeded.

## 6. Non-Functional Requirements

**Performance**

- **NFR1** — Core interactions feel instantaneous: optimistic UI updates render ≤100ms; API responses p95 ≤300ms. "Normal single-user load" is defined as a **single sequential user with no concurrent requests** — the target is a per-request latency smoke, not a multi-client load test (resolves former open item U1). `[ASSUMPTION]`
- **NFR2** — Initial list load renders promptly: the loading state (FR21) appears immediately and resolves to content without an intervening blank screen.

**Reliability & Data Durability**

- **NFR3** — Todo data is durably persisted and consistent across refreshes, sessions, and server restarts (no data loss, no stale reads).
- **NFR4** — The app degrades gracefully on failure — a failed operation never corrupts state or leaves the UI inconsistent (optimistic rollback, FR23).

**Compatibility & Responsiveness**

- **NFR5** — Fully functional and visually polished on modern desktop and mobile browsers, from ~375px mobile width up.

**Maintainability & Engineering Quality**

- **NFR6** — Code is clean, conventional, and readable, organized so a new developer can extend it without tribal knowledge. Checkable signals: linter/formatter config committed and passing; consistent project structure; the ≤10-min clone-to-run proxy (SM5/NFR7).
- **NFR7** — Setup is documented and reproducible: a new developer can clone, install, and run locally in ≤10 minutes via the README, with no undocumented steps.

**Extensibility**

- **NFR8** — The architecture cleanly accommodates future auth / multi-user (data model and API structured so user-scoping can be added without a rewrite).

**Error Handling & Robustness**

- **NFR9** — Both client and server handle failures gracefully with clear, non-disruptive feedback; no unhandled exceptions surface to the user in normal use (errors are caught and rendered as the error state, FR22).
- **NFR10** — Inputs are validated and sanitized server-side (not only client-side) — a baseline engineering-quality and safety signal even without auth.

**Deployment**

- **NFR11** — The application is containerized and starts with a single `docker compose up`, bringing up the full stack (frontend + backend + datastore) for a reviewer.

## 7. Out of Scope (v1)

The first version intentionally excludes the following to preserve a clean, reliable core:

- User accounts / authentication, multi-user support, collaboration & sharing
- Task prioritization, manual reordering, deadlines / due dates, reminders / notifications
- Categories / tags / projects, search & filtering, recurring tasks
- Accessibility as a hard v1 commitment (deferred, not rejected — see Future Considerations)

## 8. Future Considerations

These are explicitly deferred, and the architecture (NFR8) is designed not to preclude them:

- Authentication and multi-user support (per-user todo lists)
- Collaboration / sharing
- Task prioritization, deadlines, reminders / notifications
- Additional `status` lifecycle states (e.g., `in_progress`, `archived`)
- Accessibility hardening (full keyboard operability, screen-reader labels, `prefers-reduced-motion` support — OQ3)

## 9. Open Questions

_All open questions resolved:_

- **OQ1** — Datastore → **PostgreSQL** (own container, multi-user-friendly). Resolved 2026-07-17.
- **OQ2** — Undo toast duration → **~5 seconds**. Resolved 2026-07-17.
- **OQ3** — `prefers-reduced-motion` handling → **deferred to v2** (confirmed 2026-07-17), consistent with §7/§8 (accessibility hardening deferred). The bouncy check-off and pop-to-top do **not** adapt to `prefers-reduced-motion` in v1; it joins the a11y-hardening work in Future Considerations (§8). Resolved 2026-07-17.

## 10. Glossary

- **Todo** — a single task record: unique id, `title`, optional `description`, `status`, and the `created_at` / `updated_at` timestamps (FR19).
- **title** — the required short text naming the task; the primary line shown for a todo.
- **description** — optional longer free-text notes attached to a todo; may be blank.
- **created_at / updated_at** — system-managed timestamps: `created_at` is set once at creation; `updated_at` refreshes on every modification. Neither is user-editable; `created_at` drives the relative time shown (FR6) and newest-first ordering (FR8).
- **status** — a todo's lifecycle state; a constrained enum, current values `active` | `completed`, extensible to future states (FR19).
- **active / completed** — the two v1 `status` values; `completed` is rendered visually distinct (FR7).
- **Optimistic update** — a UI change applied immediately, before the backend confirms, then reconciled or rolled back (FR23).
- **Persisted / committed** — a change durably written to the datastore and confirmed by the backend.
- **Pending delete** — a deleted todo removed from the UI but not yet committed, awaiting the Undo window (FR13–FR15).
- **Undo window** — the ~5s interval during which a pending delete can be reversed via the Undo toast (FR14).
- **Toast** — a brief, non-blocking transient message (used for Undo and, where apt, errors).
- **Datastore** — the durable persistence layer (PostgreSQL); "backend"/"server" refer to the API service in front of it.

---

_Technical stack, rationale, and downstream detail live in `addendum.md`._
