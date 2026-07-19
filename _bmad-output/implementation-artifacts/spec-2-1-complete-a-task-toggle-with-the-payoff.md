---
title: 'Complete a task (toggle with the payoff)'
type: 'feature'
created: '2026-07-19'
status: 'done'
baseline_revision: '696b7ce4ba71fc28b35924f9347f86fc5975f1fd'
final_revision: 'c76c5d41a3454f8d45cbddf4cd58a4aedb6c510d'
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

**Problem:** Todos render read-only (Story 1.3) — there is no way to complete one. Users need to check a task off, watch it settle into a satisfying "done" style, and have it persist.

**Approach:** Full-stack. Add `PATCH /todos/:id` (repository→service→handler) implementing the AD-6 partial-update contract; add a real interactive checkbox to `TodoRow` driving an optimistic `useToggleTodo` mutation (status flip by id, visible rollback on failure, settle against server); render the completed visual (terracotta filled check, strikethrough + muted title, recessed card) with a CSS spring settle that **decorates but never gates** the ≤100ms optimistic change.

## Boundaries & Constraints

**Always:**
- `PATCH /todos/:id` implements AD-6 partial update: body carries only the fields being changed, decoded as **pointers** (absent/nil = unchanged, never a zero-value overwrite); any field combination is atomic; success is **200 + the full resource** (reuse `toTodoResponse`); `updated_at = now()` is set on every update (there is no DB trigger).
- `status` is validated against the AD-8 allow-list (`active`|`completed`) in the **service** — the second sync point besides the DB CHECK; an invalid status returns `400 validation_error` and never reaches the repo.
- The optimistic toggle pairs `onMutate` (flip status by id) with `onError` (visible flip-back to prior status) and settles against the server (AD-4); reuse the `useCreateTodo` shape (id-based rollback, `onSettled` gated on `isMutating === 1`). TanStack cache is the sole owner (no local list copy).
- SQL is parameterized; the checkbox is a **real semantic control** (`role="checkbox"`/`<input type="checkbox">`, `aria-checked`); motion decorates, never gates the ≤100ms optimistic state change; consume CSS tokens only.
- Client renders the server row on success (fresh `updatedAt`); the client never generates timestamps (AD-7).

**Block If:**
- The status toggle cannot be persisted without a schema/migration change (unexpected — the `status` CHECK already permits both values; if a migration is genuinely required, that is out of this story's band).
- A required 2.1 behavior can only be met by pulling in delete/undo (Story 2.3) or the edit-in-place UI (Story 2.2).

**Never:** No `DELETE`, pending-delete, or undo (Story 2.3). No edit-in-place UI and no exercising of title/description editing (Story 2.2) — the PATCH endpoint accepts those fields at the contract level but 2.1 builds no edit UI and adds no title/description P0 tests. **No new animation dependency** (CSS-only motion — the visual system is bespoke and the codebase has zero anim deps). No new migration. No char counter / theme (Epic 3). No client re-sort.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| toggle to completed | `PATCH /todos/:id {status:'completed'}` on an active row | 200 + full AD-6 resource, `status='completed'`, `updatedAt` bumped | — |
| toggle back to active | `{status:'active'}` on a completed row | 200 + resource, `status='active'` | — |
| invalid status | `{status:'archived'}` | never reaches repo/DB | `400 validation_error` |
| unknown id | valid body, id not in table | repo `pgx.ErrNoRows` → service not-found → handler | `404 not_found` |
| empty patch | `{}` (all fields nil) | 200 + current resource, unchanged (no-op) | — |
| title patch (contract only) | `{title:'x'}` | 200 + resource with trimmed title (validated, ≤200 code points) | `400` if over cap |
| optimistic flip | user taps checkbox | row flips completed style in ≤100ms (spring decorates); on 200 server row swapped in | — |
| toggle rejected | server returns 5xx/network/timeout | checkbox/row **visibly flips back** to prior status + non-disruptive error | rollback (AC) |

</intent-contract>

## Code Map

**Backend (api):**
- `api/model/todo.go` -- add a `NotFoundError` type mirroring `ValidationError` (handler maps it via `errors.As` to `404 CodeNotFound`, first use of `CodeNotFound`).
- `api/repository/repository.go` -- add `UpdateTodo(ctx, id string, title, description, status *string) (model.Todo, error)` to the interface + `*Postgres`: a **parameterized** `UPDATE` that SETs only the provided (non-nil) columns plus `updated_at = now()`, `WHERE id=$n RETURNING …`; `pgx.ErrNoRows` → `model.NotFoundError`. If no fields provided, SELECT-return the current row.
- `api/service/service.go` -- add `UpdateTodo(...)`: validate each provided field — `status` against `{StatusActive,StatusCompleted}` (AD-8); `title`/`description` via **extracted** trim+rune-cap helpers shared with `CreateTodo` (no duplication) — then call the repo; propagate `NotFoundError`.
- `api/handler/handler.go` -- register `r.PATCH("/todos/:id", updateTodo(svc))`; add `UpdateTodo` to the local `TodoService` interface; `updateTodo` handler binds a **pointer** struct `{Title,Description,Status *string}`, reads `c.Param("id")`, maps `ValidationError`→400, `NotFoundError`→404, else→500, success→`c.JSON(200, toTodoResponse(updated))`.

**Frontend (web):**
- `web/lib/todos.ts` -- add `updateTodo(id, patch: UpdateTodoRequest): Promise<Todo>` → `PATCH /api/todos/{id}`, throw on `!res.ok`, reuse `@shared/todo` types.
- `web/lib/useToggleTodo.ts` -- **new** optimistic mutation mirroring `useCreateTodo`: `toggleTodoMutationKey`; `onMutate` cancel→snapshot prior status→`setQueryData` flip by id→return `{id, prevStatus}`; `onError` restore prior status by id; `onSuccess` swap server row by id; `onSettled` gated invalidate.
- `web/app/components/TodoRow.tsx` -- add a real checkbox (empty `ink-muted` ring when active; filled `accent` circle + `on-accent` check when completed) driving `useToggleTodo`; **own the card chrome** (raised+shadow when active, recessed transparent/no-shadow ~0.85 opacity when completed); CSS **spring settle** on toggle.
- `web/app/page.tsx` -- the `<li>` becomes a plain semantic wrapper; the card `rowStyle` moves into `TodoRow` (so it varies by status).
- `web/app/globals.css` -- add a `@keyframes` check-pop (scale overshoot) + a `prefers-reduced-motion: reduce` guard; consume existing tokens (`--accent`, `--on-accent`, `--ink-muted`, `--surface-raised`, `--shadow-row`, `--radius-full`). No new tokens.

**Tests:**
- `api/handler/handler_test.go` -- PATCH: valid→200 + AD-6 shape (status updated); invalid status→400; unknown id→404.
- `api/service/service_test.go` -- `UpdateTodo`: status allow-list, `pgx.ErrNoRows`→NotFound mapping, invalid status never reaches repo.
- `web/tests/todo-row.test.tsx` -- checkbox renders as a real control with correct `aria-checked`; clicking fires a toggle (PATCH with the flipped status).
- `web/tests/use-toggle-todo.test.tsx` -- **new** optimistic flip in cache + id-based rollback on 5xx.
- `web/tests/e2e/toggle.spec.ts` -- **new** `@p0`: seed active → click → completed style + `PATCH {status:'completed'}` observed → toggle back; and rollback-on-500 (mirror `optimistic-rollback.spec.ts`).

## Tasks & Acceptance

**Execution:**
- [x] `api/model/todo.go` -- `NotFoundError` type added.
- [x] `api/repository/repository.go` -- `UpdateTodo` (parameterized partial UPDATE, static-whitelist columns + `updated_at=now()`, RETURNING; `ErrNoRows`→NotFound; empty-patch→SELECT current row).
- [x] `api/service/service.go` -- `UpdateTodo` with AD-8 status validation + extracted shared title/description validators + not-found propagation.
- [x] `api/handler/handler.go` -- `PATCH /todos/:id` (pointer decode, 400/404/500/200 mapping, reuses `toTodoResponse`) + interface method.
- [x] `api/handler/handler_test.go`, `api/service/service_test.go` -- PATCH/UpdateTodo tests (200 shape, invalid→400, not-found→404, allow-list, empty-patch).
- [x] `web/lib/todos.ts` -- `updateTodo`.
- [x] `web/lib/useToggleTodo.ts` -- optimistic toggle mutation (id-based rollback, gated invalidate).
- [x] `web/app/components/TodoRow.tsx` + `web/app/page.tsx` + `web/app/globals.css` -- semantic checkbox, TodoRow-owned recessed completed card, terracotta check, CSS `check-pop` spring + reduced-motion guard.
- [x] `web/tests/todo-row.test.tsx`, `web/tests/use-toggle-todo.test.tsx`, `web/tests/e2e/toggle.spec.ts` -- checkbox aria-checked + optimistic flip + rollback (E2E written; run at CI/PR gate).

**Acceptance Criteria:**
- Given an active todo, when I tap its checkbox, then it toggles to `completed` optimistically (≤100ms) and persists via `PATCH /todos/:id {status}`; tapping again returns it to `active`.
- Given a completed todo, when it settles, then it is visually distinct (filled terracotta check, strikethrough + muted title, recessed) with a bouncy spring settle that never gates the ≤100ms change.
- Given the server rejects the toggle (5xx/network/timeout), then the toggle rolls back visibly to its prior state and a non-disruptive error shows.
- Given the server, when a status outside `{active,completed}` is PATCHed, then `400 validation_error`; when the id is unknown, then `404 not_found`; a valid toggle returns `200` + the full AD-6 resource with a bumped `updatedAt`.

## Design Notes

Resolutions of the seven planning-brief flags (conservative, grounded — flagged for human ratification at the PR gate):

1. **Full partial-update PATCH (not status-only).** AD-6 and `shared/todo.ts UpdateTodoRequest {title?,description?,status?}` already commit to a general partial update, and building status-only would churn the handler/service/repo signature in Story 2.2. So 2.1 builds the full pointer-decoded endpoint (per-field validation, dynamic parameterized UPDATE) but **exercises + P0-tests only the `status` path**; 2.2 adds the title/description UI + tests.
2. **CSS-only motion (no new dependency).** The visual system is bespoke, no component/animation library is named, and the codebase has zero anim deps — adding Framer Motion for one animation would violate that ethos. The spring is a CSS `@keyframes` scale-overshoot.
3. **Concrete spring:** a ~350ms check-pop keyframe with `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot → settle); the recede (bg/shadow/opacity) uses a matching transition. Tunable at review.
4. **Reduced-motion:** a minimal `@media (prefers-reduced-motion: reduce)` disables the bounce (instant state change) — cheap and correct, even though the doc defers full a11y hardening.
5. **Card chrome moves into `TodoRow`** so the row owns its active (raised) vs completed (recessed) treatment; `page.tsx`'s `<li>` becomes a plain wrapper.
6. **`model.NotFoundError`** is added mirroring `ValidationError` (first producer of `CodeNotFound`).
7. **`useToggleTodo` lives inside `TodoRow`** (matches `AddInput` owning `useCreateTodo`); `page.tsx` stays a dumb list.

Toggle mutation shape (mirrors `useCreateTodo`, no temp-id — id is stable, rollback restores prior `status`):
```ts
onMutate: ({id, status}) => { cancelQueries; snapshot prevStatus; setQueryData(map t.id===id ? {...t,status} : t); return {id, prevStatus}; }
onError:  (_e,_v,ctx) => setQueryData(map t.id===ctx.id ? {...t,status:ctx.prevStatus} : t)   // visible flip-back
onSuccess:(srv,_v,ctx)=> setQueryData(map t.id===ctx.id ? srv : t)                            // adopt server updatedAt
onSettled:()          => { if (isMutating({mutationKey:toggleTodoMutationKey})===1) invalidateQueries }
```

## Verification

**Commands:**
- `cd web && npm run test:unit && npm run lint && npm run format:check && npx tsc --noEmit` -- expected: all green.
- api (in container, Go not on host): `gofmt -l .` clean, `go vet ./...`, `go build ./...`, `go test ./...` green (handler/service PATCH tests).
- `cd web && npm run test:e2e:p0` -- toggle + rollback specs green (test-compose stack).

**Manual checks:**
- `docker compose up` → tap a task's checkbox: it flips to completed (terracotta check, strikethrough, recessed) with a bouncy settle in ≤100ms; reload → still completed (persisted); tap again → back to active; force a `PATCH` 500 → the toggle visibly reverts + error shows; `curl` an invalid status → `400`, an unknown id → `404`.

## Review Triage Log

### 2026-07-19 — Expert review pass (Gopher [Go] + Pixel [web])
- intent_gap: 0
- bad_spec: 0
- patch: 8 (medium 4, low 4)
- defer: 0
- reject: 0
- addressed_findings:
  - `[medium]` `[patch]` P1 — a rejected toggle rolled back but showed NO error (AC3 gap). Added a `role="alert"` rollback notice in `TodoRow` (mirrors `AddInput`, sanctioned copy) + an E2E assertion for it.
  - `[medium]` `[patch]` P3 — same-tick double-tap desync (target status read from the stale `todo` prop). `handleToggle` now reads the current status from the query cache, so a rapid re-toggle sends the correct target.
  - `[medium]` `[patch]` P2 — the rollback E2E was tautological (asserted the initial `aria-checked='false'`). Rewrote to assert the PATCH fired + the error surface + the rolled-back state — it can no longer pass on a no-op click.
  - `[medium]` `[patch]` G1 — a malformed (non-uuid) id returned `500` instead of `404` (AD-9 misclassification). The repo now maps Postgres `22P02` → `NotFoundError` via a shared `todoByIDErr` helper (kept in the repository, AD-1).
  - `[low]` `[patch]` P4 — the single-row rollback unit test couldn't prove the id-scoped (not whole-list) restore. Added a two-row concurrent-toggle test.
  - `[low]` `[patch]` G2 — the dynamic `$n` UPDATE builder (riskiest code) was untested. Added a `testseed` repo integration test (multi-field update + absent-id + malformed-id).
  - `[low]` `[patch]` P5 — the clamp fade blended to `--surface-raised` on a transparent completed card. It now blends to the actual backdrop (`--surface-base` when completed).
  - `[low]` `[patch]` P6 — the `check-pop` spring replayed on every mount (pre-completed todos bounced on load). Gated to fire only on a fresh user-triggered active→completed transition.
- Gopher (Go) verified clean: injection-safe (static-whitelisted columns, all values bound), placeholder numbering across all field combos, empty-patch no-op, `errors.As` value-target matching, AD-1 layering, no CreateTodo regression from the extracted validators, contract test still holds. Zero backend defects beyond G1/G2.
- Pixel (web) verified clean: AD-4 cache sole-ownership (no local list copy), AD-7 (server row swapped on success), keyboard operability (real `<button role=checkbox>`), the `isMutating===1` gated reconcile for concurrent toggles, CSS-only motion (no new dep) that never gates the ≤100ms flip, no layout shift on recede. Pass regressions: none.

## Auto Run Result

Status: done

**Summary:** Story 2.1 (complete-a-task toggle) implemented full-stack: `PATCH /todos/:id` (AD-6 partial-update: pointer decode, parameterized dynamic UPDATE, `updated_at=now()`, 400/404/500/200 mapping, `NotFoundError` added) + an optimistic `useToggleTodo` (status flip by id, id-based visible rollback, gated reconcile) driving a real semantic checkbox in `TodoRow`, with the terracotta completed visual, a TodoRow-owned recessed card, and a CSS `check-pop` spring that decorates but never gates the ≤100ms flip. Two-expert review (Gopher + Pixel) drove 8 patches (0 intent-gaps, 0 bad-spec loopbacks).

**Files changed:** api — `model/todo.go` (NotFoundError), `repository/repository.go` (UpdateTodo + `todoByIDErr` 22P02→404), `service/service.go` (UpdateTodo + extracted validators), `handler/handler.go` (PATCH route/handler), `handler/handler_test.go`, `service/service_test.go`, `repository/repository_update_test.go` (new, testseed). web — `lib/todos.ts` (updateTodo), `lib/useToggleTodo.ts` (new), `app/components/TodoRow.tsx` (checkbox + card + spring + error surface), `app/page.tsx`, `app/globals.css` (check-pop + reduced-motion), `tests/todo-row.test.tsx`, `tests/use-toggle-todo.test.tsx` (new), `tests/e2e/toggle.spec.ts` (new).

**Review findings:** 8 patches (4 medium, 4 low), 0 deferred, 0 rejected, 0 intent-gaps, 0 bad-spec loopbacks.

**Verification:** web `npm run test:unit` → 36 passed; eslint + prettier + tsc clean. Go (container): `gofmt` clean, `go vet` + `go build` + `go test ./...` green; `go vet -tags testseed` clean (the new integration test compiles). Playwright E2E + the testseed repo integration test run at CI / the docker test stack (not on host).

**Residual risks:** (1) the CSS spring/recede + the malformed-id→404 repo path and the multi-field `$n` UPDATE are only exercisable in a real browser / against a live DB — covered by the E2E + testseed integration specs (run at CI), hence `followup_review_recommended: true`. (2) The full partial-update PATCH accepts title/description at the contract level but 2.1 ships no edit UI and no title/description P0 tests (Story 2.2's scope) — a deliberate Design-Note-1 call for PR ratification.
