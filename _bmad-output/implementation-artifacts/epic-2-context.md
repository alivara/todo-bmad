# Epic 2 Context: Complete the Task Loop

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn the create-and-view happy path from Epic 1 into a full task manager. A user can complete a task by toggling its status with a satisfying bouncy settle, edit a task's title and description in place directly in the row, and delete a task with a ~5-second undo window that makes a misclick non-destructive. These are the first stories to exercise `PATCH` and `DELETE`, the extensible status enum, and the client-side pending-delete lifecycle. Everything builds directly on Epic 1's mutation infrastructure, the fixed wire contract, and the rendered list — no new services, boundaries, or data model changes.

## Stories

- Story 2.1: Complete a task (toggle with the payoff)
- Story 2.2: Edit a task in place
- Story 2.3: Delete a task with undo

## Requirements & Constraints

- Toggle completion between `active` and `completed`; the change renders optimistically (≤100ms) and persists; toggling again reverses it. Completed todos must be visually distinct.
- Edit title and description in place; edits apply optimistically and persist on confirm (Enter or blur); Esc cancels and reverts. An edit leaving the title empty/whitespace is rejected and reverts to the prior title; clearing the description is a valid, persisted change. A no-op edit (nothing changed) issues no write.
- Delete removes the row immediately and enters a client-side pending-delete state with no network call; a ~5s Undo window restores in place with no server round-trip; on window elapse the delete commits; closing/reloading while pending commits the delete (it must not reappear).
- Every mutating action (toggle/edit/delete) rolls back visibly if the server rejects it, with no silent divergence between what is shown and what is persisted.
- Validation is server-authoritative and mirrored client-side: `title` required, non-whitespace, ≤200; `description` optional, ≤2000; both caps counted in Unicode code points, whitespace trimmed before validation, cap applied after trim.
- Interactions must feel instantaneous (optimistic render ≤100ms; motion never gates the state change); the completed-toggle motion is deliberately the app's most expressive payoff.

## Technical Decisions

**PATCH wire contract (AD-6).** `PATCH /todos/:id` sends **only the fields being changed** from `{ title, description, status }`; an absent field means unchanged (decode as optional/pointer — never a zero-value overwrite); any combination may change in one atomic call. Success is `200` + the full updated resource. Toggle sends `{ status }`; edit sends `{ title }` and/or `{ description }`. Clearing a description is an intentional `description: ""` (empty string, never `null`), distinct from an omitted/unchanged field. `updatedAt` advances server-side on every change; the client renders it, never generates it.

**DELETE wire contract (AD-6).** `DELETE /todos/:id` → `204` (empty) on success; a commit-DELETE returning `404` ("already gone") is also treated as success, not an error.

**Status as extensible text enum (AD-8).** `status` is Postgres `text` + a `CHECK` constraint (current values `active` | `completed`), not a native PG enum type. Allowed values are kept in sync in exactly two places — the DB `CHECK` and Go service validation. The toggle only moves between these two states; adding future states means editing that list, not migrating a type.

**Optimistic mutation + rollback (AD-4).** TanStack Query is the sole owner of server state; todos live in the query cache only. Every mutation pairs `onMutate` (apply optimistically, snapshot prior state) with `onError` (restore snapshot / roll back visibly) and settles against the server. Toggle, edit, and delete-commit reuse **one shared optimistic-mutation wrapper** rather than hand-rolling rollback per story (the systematized version is Epic 3's P0). No component holds a private server-derived list.

**Pending-delete lifecycle (AD-5).** Delete is a client-side lifecycle — the row is removed from the UI and a client-owned ~5s timer starts with **no network call during the window**. Undo cancels the timer with no round-trip. On elapse, the real `DELETE` fires. On page unload/close while a delete is still pending, the client flushes the `DELETE` via `navigator.sendBeacon` (or `fetch` with `keepalive: true`) so the commit survives — reload/close counts as committed. The server never knows a delete was "pending." The ~5s timer must be an injectable/controllable clock so tests are deterministic.

**Multi-delete + commit-failure behavior (resolved decisions).** A single Undo toast shows only the most recent delete and Undo targets that most recent one; each pending delete keeps its own independent ~5s commit timer; toasts do not stack (RD-4). On a failed commit `DELETE` (5xx), the row is **resurrected** into the list and the error surfaced for retry — never silently lose a record; a `404` still counts as success (RD-5).

**Error contract (AD-9).** Every non-2xx is `{ "error": { "code", "message" } }` with a fixed vocabulary (`validation_error` 400, `not_found` 404, `internal_error` 500). Client splits handling by class: `4xx` validation → inline feedback, no retry; `5xx`/network/timeout → error state + retry. (The fully systematized cross-mutation handling is Epic 3; Epic 2 relies on the same contract for its rollbacks.)

**Undo race resolution.** If an Undo tap lands before the `DELETE` request is dispatched, Undo wins and cancels the deletion; once the `DELETE` has been dispatched, the deletion is committed and Undo no longer applies.

## UX & Interaction Patterns

- **Completed row (payoff state).** Rendered settled: filled terracotta checkbox with white check, title strikethrough + muted, row recedes (transparent background/border, shadow removed, ~0.85 opacity). Active row is a raised card with a circular empty checkbox.
- **Bouncy check-off.** Completing uses a spring with a visible settle into the completed style — the app's primary emotional payoff, deliberately more expressive than any other motion; toggling back is the same motion reversed. Motion decorates and never blocks the ≤100ms optimistic change.
- **Inline edit-in-place.** The row itself becomes the editor (accent border + accent-soft ring): title field (selection highlighted) + optional description field (dashed hairline separator, placeholder "Add a description (optional)") + hint line "Enter to save · Esc to cancel". No modal, no route change. Enter/blur saves, Esc reverts.
- **Delete affordance.** A quiet ✕ icon button, low-key `ink-secondary` at rest, surfacing on row hover (accent-soft fill + accent glyph). Never a loud red trash button.
- **Undo toast.** A fully-rounded pill floating bottom-center on `surface-raised` with a deep-soft shadow; message "Task deleted" + a pill "Undo" action; non-blocking, transient (~5s), overlaps the list without displacing it.
- **Keyboard.** Enter saves an edit; Esc cancels/reverts. Consistent with the core loop's keyboard-first intent.
- **Locked microcopy (verbatim).** Edit hint "Enter to save · Esc to cancel"; description placeholder "Add a description (optional)"; undo toast "Task deleted" + "Undo". Voice stays warm, restrained, reassuring — no alarm-red, no jargon or status codes.

## Cross-Story Dependencies

- **On Epic 1:** All three stories depend on Epic 1's optimistic-mutation infrastructure (AD-4 cache + `onMutate`/`onError` pattern), the shared wire-contract type (`shared/`, AD-6 enforcement), the rendered newest-first list, and the server-authoritative validation/identity/timestamp rules (AD-7, AD-10).
- **On Epic 3:** Epic 2 uses the shared optimistic-mutation wrapper and the AD-9 error contract, but the *systematized* cross-all-four-mutations rollback (P0), the polished error/retry states, the char-limit counter UI, and the theme toggle are Epic 3. Epic 2 delivers the working behavior; Epic 3 hardens and polishes it.
- **Within Epic 2:** 2.1 (toggle) and 2.2 (edit) both go through `PATCH /todos/:id` and should share the same optimistic-mutation wrapper; 2.3 (delete) adds the distinct pending-delete controller on top of the same cache-mutation foundation.
