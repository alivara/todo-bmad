---
title: 'Delete a task with undo'
type: 'feature'
created: '2026-07-19'
status: 'done'
baseline_revision: 'cec08a1'
final_revision: 'c80f42fa3f2081ce67d39a3e635d98fd8a236cf3'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** A deleted task should vanish immediately but never be destructive on a misclick. There is no delete at all yet, and this is the story that lands the AD-5 pending-delete lifecycle.

**Approach:** Full-stack. Add a hard `DELETE /todos/:id` (204, absent → 404). On the client, activating a quiet ✕ removes the row **optimistically with NO network call** and starts a **client-owned ~5s timer**; an Undo toast (bottom-center) can restore it in place with no round-trip. On elapse the real `DELETE` fires (204 or 404 both = success); a 5xx/network failure **resurrects** the row (RD-5). A still-pending delete on tab close/reload is **flushed via `fetch keepalive`** so it commits. The server never knows a delete was "pending."

## Boundaries & Constraints

**Always:**
- Deleting removes the row from the TanStack cache immediately (optimistic) and starts a **client-owned 5000ms timer** — **NO network call during the window** (AD-5). Undo within the window cancels the timer and re-inserts the snapshot **at its original index** with **no server round-trip**. On elapse the real `DELETE /todos/:id` fires.
- The client treats **`204` AND `404` ("already gone") as success** (RD-5). A `5xx`/network/timeout commit failure **resurrects the row** at its index and surfaces a retryable error — never silently lose a record.
- Multiple concurrent pending deletes are supported; **each keeps its own timer** (RD-4). The Undo toast is **single, non-stacking** — it shows the **most recent** delete and its Undo targets that one; a new delete replaces the visible toast (older timers keep running).
- **Undo-vs-elapse race:** a per-entry `dispatched` flag is set synchronously before the commit fetch; Undo is a no-op once `dispatched` is true (the delete is committed). Undo before dispatch wins.
- On `pagehide`, every non-dispatched pending delete is flushed via `fetch('/api/todos/:id', { method: 'DELETE', keepalive: true })` (sendBeacon is POST-only) so reload/close = committed.
- Server: `DELETE` is parameterized (AD-10); success → **`204` empty**; absent row → **`404 not_found`** (AD-9 envelope). Hard delete, no schema change. The ✕ and Undo are **real focusable `<button>`s**; consume CSS tokens.

**Block If:**
- A pending-delete requirement can only be met by a server-side "pending" state or a schema change (it must not — AD-5 keeps the lifecycle entirely client-side; the server does a plain hard delete).

**Never:** No soft-delete / `deleted_at` column or migration. No network call during the undo window. **Never treat a commit-`DELETE` `404` as an error** (it is success). No `aria-live` on the toast (deferred a11y — EXPERIENCE.md). No toast stacking. No client re-sort. No char-counter/theme (Epic 3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| request delete | tap the ✕ | row removed from the list immediately; `Task deleted` + `Undo` toast (bottom-center); **no network call** while pending | — |
| undo in window | tap Undo before 5s | row restored at its original index instantly; timer cancelled; **DELETE never fires** | — |
| window elapses | 5000ms with no undo | `DELETE /todos/:id` fires once; row stays gone | 204/404 → success |
| commit already-gone | server returns 404 | treated as success; row stays gone; no error | — |
| commit fails | 5xx/network/timeout | row **resurrects** at its index + retryable error (`Something got in the way. Try again.`) | RD-5 |
| race: undo pre-dispatch | Undo lands before the fetch dispatches | Undo wins, delete cancelled | — |
| race: undo post-dispatch | Undo lands after dispatch | delete committed, Undo is a no-op | — |
| unload while pending | close/reload before 5s | `fetch DELETE keepalive` flushes; todo does not reappear | — |
| concurrent deletes | delete A then B | both removed; each has its own timer; toast shows B (most recent), Undo targets B | — |
| backend delete | `DELETE` existing / absent / malformed id | `204` / `404 not_found` / `404` (22P02) | — |

</intent-contract>

## Code Map

**Backend (api):**
- `api/repository/repository.go` -- add `DeleteTodo(ctx, id string) error` to the interface + `*Postgres`: parameterized `DELETE FROM todos WHERE id=$1` via `pool.Exec`; `tag.RowsAffected()==0` → `model.NotFoundError`; reuse `todoByIDErr` for the error branch (22P02 malformed id → NotFound). Rename `todoByIDErr`'s wrap message to operation-neutral (it currently says "update todo").
- `api/service/service.go` -- add `DeleteTodo(ctx, id string) error` (thin passthrough, propagate NotFound).
- `api/handler/handler.go` -- add `DeleteTodo` to the local `TodoService` interface; register `r.DELETE("/todos/:id", deleteTodo(svc))`; handler reads `c.Param("id")`, on success `c.Status(204)`, on `NotFoundError`→`404 CodeNotFound`, else→500.
- `web/app/api/[...path]/route.ts` -- reuse (DELETE + 204 null-body already handled). No change.

**Frontend (web):**
- `web/lib/todos.ts` -- add `deleteTodo(id)`: `DELETE /api/todos/{id}`; **404 → resolve (success), not throw** (RD-5); other `!res.ok` → throw.
- `web/lib/pendingDelete.tsx` -- **new** controller: a `PendingDeleteProvider` (mounted inside `QueryClientProvider`) + `usePendingDelete()` hook. State: `Map<id, {snapshot: Todo; index: number; timerId; dispatched: boolean}>`. `requestDelete(todo)` (snapshot+index, cache-remove, start 5000ms timer, set as visible toast); `undo(id)` (guard `!dispatched`, clear timer, re-insert at index); timer elapse (set `dispatched`, fire `deleteTodo`, drop entry; on 5xx resurrect at index + error); `pagehide` listener flushing non-dispatched entries via keepalive DELETE. Exposes the visible entry + `undo`.
- `web/app/components/UndoToast.tsx` -- **new** bottom-center pill: `Task deleted` + an `Undo` `<button>` (single, non-stacking, most recent). Reads the controller; hidden when nothing pending.
- `web/app/components/TodoRow.tsx` -- add a quiet, always-rendered, focusable ✕ `<button>` (`aria-label` `Delete {title}`, hover-emphasis) calling `usePendingDelete().requestDelete(todo)`.
- `web/app/providers.tsx` + `web/app/page.tsx` -- wrap children in `PendingDeleteProvider` (inside `QueryClientProvider`); mount `<UndoToast />` at page level above the list.
- `web/app/globals.css` -- consume tokens (`--surface-raised`, `--accent`, `--accent-soft`, `--ink-secondary`, `--radius-sm/full`, shadow); no new tokens.

**Tests:**
- `api/handler/handler_test.go`, `api/service/service_test.go`, `api/handler/contract_test.go` -- add `DeleteTodo` to the stubs; DELETE→204, absent→404, malformed→404, repo `RowsAffected==0`→NotFound.
- `web/tests/pending-delete.test.tsx` -- **new** (Vitest + `vi.useFakeTimers`): delete → cache-removed + no fetch during window; undo → restored at index + DELETE never fires; advance 5000ms → DELETE fires (204); 404→success; 5xx→resurrect at index + error; undo-vs-dispatch race.
- `web/tests/e2e/delete.spec.ts` -- **new** `@p0` (`page.clock`): delete → row gone + toast + no DELETE while paused; undo → restored; `fastForward(5000)` → DELETE observed; failed commit → resurrect.

## Tasks & Acceptance

**Execution:**
- [x] `api/repository/repository.go` -- `DeleteTodo` (Exec, RowsAffected==0→NotFound, 22P02 via todoByIDErr) + neutral wrap message + interface method.
- [x] `api/service/service.go` + `api/handler/handler.go` -- `DeleteTodo` passthrough + `DELETE /todos/:id` (204/404/500) + interface method.
- [x] `api/handler/handler_test.go`, `api/service/service_test.go`, `api/repository/repository_delete_test.go` -- stub `DeleteTodo` + DELETE 204/404/malformed/RowsAffected tests (contract_test shares the stub, no change).
- [x] `web/lib/todos.ts` -- `deleteTodo` (404-as-success).
- [x] `web/lib/pendingDelete.tsx` -- the pending-delete controller (Map of per-id timers, undo, dispatched-guard, resurrect, keepalive unload flush).
- [x] `web/app/components/UndoToast.tsx` -- bottom-center `Task deleted` + `Undo` (single non-stacking).
- [x] `web/app/components/TodoRow.tsx` -- quiet focusable ✕ affordance.
- [x] `web/app/providers.tsx` + `web/app/page.tsx` -- mount provider + toast.
- [x] `web/tests/pending-delete.test.tsx`, `web/tests/e2e/delete.spec.ts` -- lifecycle coverage with fake clocks (E2E run at CI).

**Acceptance Criteria:**
- Given a todo, when I activate its quiet delete, then the row is removed immediately (optimistic, client-side pending state, no network call) and an Undo toast appears bottom-center for ~5s.
- Given a pending delete, when I tap Undo within the window, then the todo is restored in place instantly with no server round-trip.
- Given a pending delete, when the ~5s window elapses without Undo, then `DELETE /todos/:id` fires, treating 204 or 404 as success.
- Given an Undo that races the boundary, when it lands before the DELETE is dispatched, then Undo wins; once dispatched, the deletion is committed and Undo no longer applies.
- Given a pending delete, when I close/reload the tab before the window elapses, then the delete is flushed via `fetch keepalive` and treated as committed — the todo does not reappear.
- Given a commit `DELETE` fails (5xx/network), then the row resurrects and a retryable error is shown (RD-5).

## Design Notes

Resolutions of the planning flags (conservative, grounded — for PR ratification):

1. **Delete ✕ always rendered** (quiet `ink-secondary`), hover-emphasis on pointer devices — mobile-first (375px, no hover) requires it be tappable without hover. It is a **real focusable `<button>`** (keyboard-reachable) even though full keyboard traversal of the toast is otherwise deferred (a11y floor = real controls).
2. **`fetch(url, {method:'DELETE', keepalive:true})` on `pagehide`** (not `beforeunload`, for bfcache correctness). `navigator.sendBeacon` is POST-only and cannot DELETE — dropped from the approach.
3. **Visibility is driven by a suppressed-id set, not by mutating the cache** (corrected in review — see Spec Change Log). The cache always holds server truth; `requestDelete` suppresses the id and the list `useQuery` filters pending ids via `select`, so a refetch/invalidate during the window (from a concurrent mutation's `onSettled`, or `refetchOnWindowFocus`) **cannot resurrect the row**. Undo just un-suppresses → the row reappears in its natural position (no re-insert, no captured index, no dup-key). On commit success the row is dropped from the cache permanently; on 5xx it un-suppresses (resurrect) + a **scoped, auto-clearing** error.
4. **RD-4 single non-stacking toast:** the Map holds all pending deletes (each its own 5000ms timer); only the most-recent is shown/undoable via the toast. Older ones commit silently on their timers — the literal RD-4 reading.
5. **One 5000ms timer per entry** drives both the commit and the toast visibility.
6. **Undo-vs-elapse race:** the timer callback sets `entry.dispatched = true` synchronously **before** the fetch; `undo(id)` acts only if `!dispatched`. Deterministic "Undo wins before dispatch."
7. **RD-5 resurrect:** on a 5xx/network commit failure, re-insert the snapshot at its index and show the sanctioned `Something got in the way. Try again.` in the toast; **404 is success** (row stays gone).
8. **Locked microcopy verbatim:** toast `Task deleted`, action `Undo`.

Controller shape (bespoke — NOT a TanStack optimistic mutation; the network is deferred):
```ts
requestDelete(todo): snapshot {todo, index}; setQueryData(rows => rows.filter(t=>t.id!==id)); timerId=setTimeout(commit, 5000); map.set(id, {snapshot,index,timerId,dispatched:false}); showToast(id)
undo(id): const e=map.get(id); if(!e||e.dispatched) return; clearTimeout(e.timerId); setQueryData(rows => insertAt(rows, e.index, e.snapshot)); map.delete(id)
commit(id): const e=map.get(id); e.dispatched=true; deleteTodo(id).then(()=>map.delete(id)).catch(()=> { setQueryData(insertAt(index, snapshot)); showError(); })
pagehide: for each !dispatched entry → fetch DELETE keepalive
```

## Verification

**Commands:**
- `cd web && npm run test:unit && npm run lint && npm run format:check && npx tsc --noEmit` -- all green (Vitest fake timers for the controller).
- api (container): `gofmt -l .` clean, `go vet ./...`, `go build ./...`, `go test ./...` green (DELETE 204/404 tests).
- `cd web && npm run test:e2e:p0` -- delete/undo specs green (`page.clock` fast-forward).

**Manual checks:**
- `docker compose up` → hover a row, click ✕: it vanishes + `Task deleted`/`Undo` toast; click Undo → it returns in place (check network: no DELETE fired); delete again and wait ~5s → a `DELETE` fires (network), reload → still gone; delete then reload immediately → still gone (keepalive flush); force a `DELETE` 500 → the row reappears + error.

## Spec Change Log

### 2026-07-19 — pending-delete mechanism corrected (Pixel HIGH finding)
- **Triggering finding:** the original Design Note prescribed modelling "deleted" as **absence from the TanStack cache** (`setQueryData` filter on request, re-insert at a captured `index` on undo). Pixel proved this is a correctness hole: the server still holds the row during the 5s window, and any refetch (a concurrent toggle/edit's `onSettled` invalidate, or `refetchOnWindowFocus` with `staleTime:5000`) **resurrects it** — causing a dup-React-key on undo or a zombie row on elapse. Reachable via "delete one task, toggle another."
- **Amendment:** visibility is now driven by a **suppressed-id set** + the list query's `select` filter; the cache holds server truth and is only mutated on commit-success (permanent drop). Undo un-suppresses (natural-position reappear, no index). See Design Note 3.
- **Known-bad state avoided:** a refetch mid-window can no longer show a deleted row; no dup-key; no zombie.
- **KEEP:** the per-entry `dispatched` race guard (Pixel confirmed it sound), the keepalive `pagehide` flush, the locked microcopy, and the backend DELETE slice (Gopher: ships) — all survived unchanged.

## Review Triage Log

### 2026-07-19 — Expert review pass (Gopher [Go] + Pixel [web])
- intent_gap: 0
- bad_spec: 0 (the mechanism correction was applied as a targeted patch + Spec Change Log, not a full re-derive — backend + UI + the race guard were all correct)
- patch: 6 (high 1, medium 2, low 3)
- defer: 0
- reject: 1 (Gopher trivial nit — folded into the G1 fix)
- addressed_findings:
  - `[high]` `[patch]` P1 — a refetch during the window resurrected the deleted row (cache-absence unprotected). Re-architected the controller to a **suppressed-id set + list `select` filter** (cache = server truth); refetches can no longer resurrect; restore-in-place is automatic.
  - `[medium]` `[patch]` P2 — a background commit error clobbered a newer pending toast's Undo and was sticky. Error is now **scoped to its entry id** (shown only when it matches the visible toast) and **auto-clears**.
  - `[medium]` `[patch]` P3 — tests used `staleTime:Infinity` (masking P1) and lacked keepalive/concurrency coverage. Reworked the harness to mirror prod (`select` filter, `staleTime:5000`); added: refetch-mid-window-doesn't-resurrect, keepalive-on-pagehide, RD-4 concurrency.
  - `[low]` `[patch]` P4 — pending timers weren't cleared on provider unmount. Added a mount-cleanup effect clearing every entry timer + the error timer.
  - `[low]` `[patch]` P5 — dead `todoTitle` field removed.
  - `[low]` `[patch]` G1 — the malformed-id handler test's comment overstated coverage (a stub can't exercise the repo's 22P02 mapping — that lives in the testseed integration test). Rewrote the comment honestly + added the envelope assertion (folds in Gopher's trivial nit).
- Gopher (Go): the DELETE slice **ships** — parameterized DELETE, `RowsAffected()==0`→404, 22P02 via `todoByIDErr`, 204 empty body, AD-1 layering, idempotent (2nd DELETE→404). Only the G1 test-quality item.
- Pixel (web): the **`dispatched` undo-vs-elapse race guard is sound**; `deleteTodo` 404-as-success, keepalive mechanism, locked copy, ✕/Undo a11y, ✕ coexistence all clean. The one production-reachable bug (P1) is fixed and now covered.

## Auto Run Result

Status: done

**Summary:** Story 2.3 (delete a task with undo) implemented full-stack — the AD-5 pending-delete lifecycle. Backend: hard `DELETE /todos/:id` (204 / absent→404 / malformed→404). Frontend: a quiet focusable ✕ + a bespoke pending-delete controller (client-owned 5000ms timer, NO network during the window, `Task deleted`/`Undo` single non-stacking toast, per-entry `dispatched` race guard, keepalive `pagehide` flush) with **204/404 = success** and **5xx = resurrect** (RD-5). Two-expert review found a HIGH correctness bug (refetch-resurrects-the-row) which was fixed by re-architecting the controller to a suppressed-id-set + list `select` model; 5 more findings patched.

**Files changed:** api — `repository/repository.go` (DeleteTodo + neutral `todoByIDErr`), `service/service.go`, `handler/handler.go`, `handler/handler_test.go`, `service/service_test.go`, `repository/repository_delete_test.go` (new, testseed). web — `lib/todos.ts` (deleteTodo 404-success), `lib/pendingDelete.tsx` (new controller, suppressed-set model), `app/components/UndoToast.tsx` (new, scoped error), `app/components/TodoRow.tsx` (✕), `app/providers.tsx` (provider), `app/page.tsx` (select filter + toast), `app/globals.css` (delete button), `tests/pending-delete.test.tsx` (new), `tests/e2e/delete.spec.ts` (new), `tests/todo-row.test.tsx`, `tests/support/fixtures.ts`.

**Review findings:** 6 patches (1 high, 2 medium, 3 low), 0 deferred, 1 reject (folded), 0 intent-gaps, 0 bad-spec loopbacks.

**Verification:** web `npm run test:unit` → 59 passed; eslint + prettier + tsc clean. Go (container): gofmt/vet/build/test green, testseed compiles. Playwright E2E (`delete.spec.ts`, `page.clock`) + the testseed repo integration test run at CI.

**Residual risks:** the timer/undo/keepalive/refetch lifecycle is intricate and best confirmed in a real browser (jsdom fakes timers/pagehide; `page.clock` covers the E2E) — hence `followup_review_recommended: true`. The suppressed-set model is new; the added refetch-mid-window and concurrency tests guard it, but a browser pass on the full delete→toggle-another→undo path is worth doing before release.
