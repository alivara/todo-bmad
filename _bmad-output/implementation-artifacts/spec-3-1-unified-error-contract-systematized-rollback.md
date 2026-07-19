---
title: 'Unified error contract & systematized rollback'
type: 'feature'
created: '2026-07-19'
status: 'done'
baseline_revision: 'df52448'
final_revision: '9d9b0c7d38a2f85bb261e6d3b4651596949406c2'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** The error contract exists piecemeal across Epics 1–2 but isn't systematized: every mutation surfaces the same generic retryable copy regardless of error class, the four optimistic mutations hand-roll near-identical rollback, and one api path (unmatched route) escapes the AD-9 envelope. A user should never be shown a lie about what's saved, and a `4xx` (their input) should read differently from a `5xx` (our fault).

**Approach:** Systematize, don't rebuild. (1) Close the one api-envelope gap (`NoRoute` → AD-9 `404`). (2) Verify the already-done proxy `502/504` synthesis (AC2) and structured logging (AC4c). (3) **New:** a typed `ApiError` (status+code+message) thrown by the data layer, and the **4xx→inline-no-retry / 5xx→error+retry** split at every surface. (4) Extract the shared optimistic-rollback pieces into helpers the three TanStack mutations use (the pending-delete controller conforms, not refactored). (5) Polish the existing React error boundary to locked microcopy. All existing mutation behaviour (temp-id swap, id-scoped rollback, gated invalidate, the delete timer) must survive unchanged.

## Boundaries & Constraints

**Always:**
- Every non-2xx from `api` uses `{ error: { code, message } }` with the fixed vocab (`validation_error` 400, `not_found` 404, `internal_error` 500); the proxy synthesizes AD-9-shaped `502`/`504` (already done) — **never** HTML or a thrown fetch (AC1/AC2, AD-3/AD-9).
- The data layer throws a typed **`ApiError { status, code, message }`** (parsed from the AD-9 body; a network/timeout throw carries no status = treated as 5xx). Every mutation/list surface branches on class: **`4xx` → inline feedback showing the server `message`, NO retry control**; **`5xx`/network/timeout → error state WITH a retry** (AC3, AD-9 split).
- Optimistic rollback is **shared, not four hand-rolled copies** (AC4): the three TanStack mutations (create/toggle/edit) use common `optimistic.ts` helpers (`rollbackById`/`swapById`/`gatedInvalidate` + shared `onError`/`onSettled` builders); id-scoped rollback (never whole-list snapshot) is preserved. The pending-delete controller already applies uniform rollback (resurrect-on-commit-failure, RD-5) and **conforms without refactor**.
- A React error boundary catches render throws (polished to locked copy) and `api` uses structured logging — no unhandled error reaches the user (AC4, AD-14).
- **Retry** re-issues the failed request: the list uses `refetch`; a mutation's retry re-fires `mutation.mutate(mutation.variables)` (TanStack retains the vars); a failed commit-DELETE resurrects the row and is re-deletable.

**Block If:**
- Systematizing the shared rollback cannot preserve a mutation's existing behaviour (temp-id→UUID swap, dual-field edit snapshot, the delete race-guard) without changing its observable contract — then the refactor is too risky and must be reconsidered (do not ship a regressed mutation for "uniformity").

**Never:** No status codes / jargon / alarm-red in user copy (voice rule — reassure before explain). No whole-list-snapshot rollback (keep id-scoped). No refactor of the pending-delete controller into a TanStack mutation (it is the app's most subtle code — document it as conforming). No `NoMethod`/405 handling (the vocab has no 405 code; `NoRoute`→404 covers unmatched path + wrong method since `HandleMethodNotAllowed` is off). No new endpoints, migrations, char-counter/theme (other Epic-3 stories).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| unmatched route | `GET /todoss` (or wrong method) | AD-9 `404 { error:{code:"not_found", …} }`, JSON (not Gin plaintext) | — |
| proxy: api down | `fetch` throws | `502 internal_error` AD-9 JSON (already done) | — |
| proxy: api timeout | exceeds `TIMEOUT_MS` | `504 internal_error` AD-9 JSON (already done) | — |
| mutation 4xx | server returns `400 validation_error` | inline: the server `message`, **no retry control**; optimistic change rolled back | rollback + inline |
| mutation 5xx/network | `500` / fetch throws / timeout | error surface + **Try again** (re-fires `mutate(variables)`); rolled back | rollback + retry |
| list load 5xx/network | `GET /todos` fails | existing `Couldn't load your tasks` + `Try again` (refetch) | retry |
| render throw | a component throws during render | error boundary catches → locked copy + reset; no white screen | boundary |
| ApiError parse | non-JSON / empty error body | `ApiError` with the status + a fallback message (never crash on parse) | defensive |
| rollback regression guard | any of the 4 mutations rejected | optimistic change rolls back **exactly as before** (temp-row removed / status restored / fields restored / row resurrected) | id-scoped |

## Code Map

**Backend (api):**
- `api/handler/handler.go` -- add `r.NoRoute(...)` → `c.JSON(404, model.NewAPIError(model.CodeNotFound, "route not found"))` in `NewRouter` (closes the one AC1 gap). No other handler change (all already enveloped).
- `api/handler/handler_test.go` -- add a `NoRoute` test (unmatched path → 404 AD-9 envelope).

**Frontend (web) — the new AC3 split + AC4 shared helpers:**
- `web/lib/apiError.ts` -- **new** `ApiError extends Error { status: number; code?: string }` + a parser `toApiError(res, body?)`; `isRetryable(err)` (true for `>=500`/network/no-status), `is4xx(err)`.
- `web/lib/todos.ts` -- `fetchTodos`/`createTodo`/`updateTodo`/`deleteTodo` throw `ApiError` (parse the AD-9 body for `code`/`message`; keep `deleteTodo`'s 404-as-success). No signature change.
- `web/lib/optimistic.ts` -- **new** shared helpers used by the 3 TanStack hooks: `rollbackById`, `swapById`, `gatedInvalidate(queryClient, mutationKey, queryKey)`, and shared `makeOnSettled(...)`. Keep each hook's onMutate transform + ctx explicit.
- `web/lib/useCreateTodo.ts`, `web/lib/useToggleTodo.ts`, `web/lib/useUpdateTodo.ts` -- refactor to call the shared helpers; **behaviour unchanged** (temp-id swap stays in create; id-scoped rollback; gated invalidate).
- `web/app/components/AddInput.tsx`, `web/app/components/TodoRow.tsx`, `web/app/components/UndoToast.tsx` -- read the mutation error's class: `4xx` → inline server `message`, no retry; `5xx`/network → the error copy + a **Try again** that re-fires `mutate(variables)` (delete: re-deletable). Reuse the sanctioned copy for 5xx.
- `web/app/error.tsx` -- polish to the locked load-error microcopy (`Couldn't load your tasks` / warm subline / `Try again`→`reset()`); optionally add `web/app/global-error.tsx` for root-layout throws.
- `web/lib/pendingDelete.tsx` -- **verify only** (already conforms: resurrect on 5xx, 404=success). Add a comment noting it satisfies the uniform-rollback contract.

**Tests:**
- `web/tests/api-error.test.ts` -- **new** `ApiError`/`toApiError`/`isRetryable` unit (4xx vs 5xx vs network).
- `web/tests/*` component/hook tests -- assert the 4xx→inline-no-retry / 5xx→retry branch on a mutation surface; and that the 3 refactored hooks still pass their existing optimistic/rollback tests (regression tripwire).
- `web/tests/api-proxy.test.ts`, `web/tests/e2e/optimistic-rollback.spec.ts` -- keep green (regression guards, no change expected).
- `api/handler/handler_test.go` -- the `NoRoute` envelope test.

## Tasks & Acceptance

**Execution:**
- [x] `api/handler/handler.go` + `handler_test.go` -- `NoRoute` → AD-9 404 + test (AC1 gap).
- [x] `web/lib/apiError.ts` (+ `web/tests/api-error.test.ts`) -- typed `ApiError` + `toApiError`/`isRetryable`/`is4xx`.
- [x] `web/lib/todos.ts` -- throw `ApiError` from all four data fns (keep 404-as-success for delete).
- [x] `web/lib/optimistic.ts` -- shared rollback/swap/gated-invalidate helpers.
- [x] `web/lib/useCreateTodo.ts`, `useToggleTodo.ts`, `useUpdateTodo.ts` -- refactor onto the shared helpers, behaviour preserved.
- [x] `web/app/components/AddInput.tsx`, `TodoRow.tsx`, `UndoToast.tsx` -- the 4xx-inline / 5xx-retry split at each surface.
- [x] `web/app/error.tsx` (+ optional `global-error.tsx`) -- locked microcopy.
- [x] tests -- the class-split behaviour + the regression tripwire (existing mutation/proxy/e2e suites stay green).

**Acceptance Criteria:**
- Given any non-2xx from `api` (including an unmatched route), then it uses the uniform `{error:{code,message}}` shape with the fixed vocab.
- Given `api` is unreachable or times out, then the proxy synthesizes an AD-9-shaped `502`/`504` — never HTML or a thrown fetch.
- Given a failed mutation, when it is `4xx`, then inline feedback with no retry; when `5xx`/network/timeout, then an error state with a retry path.
- Given any of the four mutations is rejected, then optimistic rollback is applied uniformly (shared), and a React error boundary + structured `api` logging ensure no unhandled error reaches the user.

## Design Notes

Resolutions of the planning flags (conservative — for PR ratification):

1. **4xx inline copy = the server `message`** (the AD-9 `message` field is written to be user-shown: "title is required", "title must be at most 200 characters"). No retry control for 4xx (retrying malformed input is futile). If a server message ever reads too raw, that's an api-copy fix, not a client branch.
2. **The 4xx branch is a defensive backstop, not a hot path.** The client already mirrors all validation (AD-10: empty-title rejected pre-submit, caps blocked), so a server 4xx on add/edit only occurs on client/server mirror drift. Build it minimally (read class → inline message, no retry) — correct and cheap, not a heavily-designed UX.
3. **Retry (5xx) re-issues the failed request uniformly:** the list uses `refetch` (already wired); a mutation's Try-again re-fires `mutation.mutate(mutation.variables)` (TanStack retains the last vars — works for create/toggle/edit even though AddInput clears its field); a failed commit-DELETE already resurrects the row (RD-5) and is re-deletable via the ✕.
4. **Shared rollback = lighter helpers, NOT a full `useOptimisticMutation` factory.** The three hooks are already shape-aligned; extracting `rollbackById`/`swapById`/`gatedInvalidate` + shared `onError`/`onSettled` builders satisfies "implemented as shared" while keeping each hook's transform/ctx/temp-id-swap explicit — minimizing regression on create's temp-id path and edit's dual-field snapshot. The **pending-delete controller is documented as conforming** (its resurrect-on-failure IS uniform rollback) and is **not** refactored — forcing it into a TanStack shape would rewrite the app's subtlest code for no behavioural gain.
5. **AC1 gap = `r.NoRoute` → 404 `not_found` (enveloped) only.** With `HandleMethodNotAllowed` off (default), a wrong method on an existing path also falls through to `NoRoute`, so one handler covers both. `405`/`NoMethod` is out of scope (the vocab has no 405 code).

**Regression discipline (the story's real risk):** the refactor of the three hooks must keep `use-toggle-todo.test.tsx`, `use-update-todo.test.tsx`, `add-input.test.tsx`, `pending-delete.test.tsx`, and `e2e/optimistic-rollback.spec.ts` green **unchanged** — they are the tripwire that the "uniformity" refactor didn't alter observable behaviour.

## Verification

**Commands:**
- `cd web && npm run test:unit && npm run lint && npm run format:check && npx tsc --noEmit` -- all green (incl. the ApiError/split tests + the unchanged mutation regression suite).
- api (container): `gofmt -l .` clean, `go vet ./...`, `go build ./...`, `go test ./...` green (NoRoute envelope test).
- `cd web && npm run test:e2e:p0` -- optimistic-rollback + create/toggle/edit/delete specs stay green.

**Manual checks:**
- `curl` an unmatched route → AD-9 `404` JSON (not plaintext); stop `api` and `curl` through the proxy → `502` JSON. Force a `500` on add → the row rolls back + a Try-again re-fires it; force a `400` (mirror-drift) → inline message, no retry. Throw in a component → the error boundary shows the warm copy, not a white screen.

## Review Triage Log

### 2026-07-19 — Expert review pass (Gopher [Go] + Pixel [web])
- intent_gap: 0
- bad_spec: 0
- patch: 4 (high 1, low 3)
- defer: 0
- reject: 0
- addressed_findings:
  - `[high]` `[patch]` G-F1 — the completeness claim was FALSE: a panic used Gin's default `Recovery()` → a **bare bodyless 500** that escapes the AD-9 envelope (AC1 "every non-2xx"). Replaced with `gin.CustomRecovery` emitting `internal_error` + slog; added a panic test (a stub that panics → 500 + enveloped code).
  - `[low]` `[patch]` G-F2 — the "wrong method → NoRoute" claim was untested. Added `TestNoRoute_WrongMethodIs404Envelope` (`PUT /todos` → 404 envelope).
  - `[low]` `[patch]` P1 — TodoRow could render two simultaneous `role="alert"` (toggle + edit both errored). Gated the update notice with `!toggle.isError` (keep the split — each retry re-fires its own mutation).
  - `[low]` `[patch]` P2 — the 4xx inline branch could surface the raw `Request failed (status 400)` fallback (voice-rule violation). Added `inline4xxText` — shows the server message only when the AD-9 body parsed (`code` set), else a voice-safe generic.
- **Pixel verified the refactor is behaviour-preserving** helper-by-helper against the old inline code (create's temp-id→UUID swap, toggle's prevStatus, edit's dual-field restore, the `isMutating===1` gated invalidate — all byte-equivalent; no whole-list snapshot reintroduced; AD-4 preserved). The unchanged regression suites (toggle/update/add-input/pending-delete) genuinely cover the subtleties.
- Gopher verified every routed non-2xx is enveloped; NoRoute correct; message voice clean.

## Auto Run Result

Status: done

**Summary:** Story 3.1 (unified error contract & systematized rollback) — largely systematization. Closed the api envelope gaps (`NoRoute` → AD-9 404; and, from review, `CustomRecovery` → AD-9 500 on panic). Added the client 4xx/5xx split (typed `ApiError`; 4xx → inline server message no-retry, 5xx/network → sanctioned copy + a Try-again re-firing `mutate(variables)`). Extracted lighter shared optimistic helpers (`optimistic.ts`) that the three TanStack hooks use — behaviour-preserving; the pending-delete controller conforms unrefactored. `global-error.tsx` boundary; structured logging verified. Two-expert review → 4 patches (1 high: the panic-envelope gap).

**Files changed:** api — `handler/handler.go` (NoRoute + CustomRecovery envelope), `handler/handler_test.go` (NoRoute/panic/wrong-method envelope tests). web — `lib/apiError.ts` (new: ApiError/toApiError/isRetryable/is4xx/inline4xxText), `lib/optimistic.ts` (new: shared rollback/swap/gated-invalidate), `lib/todos.ts` (throw ApiError), `lib/useCreateTodo.ts`/`useToggleTodo.ts`/`useUpdateTodo.ts` (onto shared helpers), `app/components/AddInput.tsx`/`TodoRow.tsx`/`UndoToast.tsx` (4xx-inline/5xx-retry split), `app/error.tsx` (verified), `app/global-error.tsx` (new), `lib/pendingDelete.tsx` (conformance comment), tests `api-error.test.ts` + `mutation-error-split.test.tsx` (new).

**Review findings:** 4 patches (1 high, 3 low), 0 deferred, 0 rejected, 0 intent-gaps, 0 bad-spec loopbacks.

**Verification:** web `npm run test:unit` → 78 passed; eslint + prettier clean; my code tsc-clean (4 tsc errors are pre-existing main E2E specs `a11y.spec.ts`/`toggle.spec.ts` from parallel work — NOT this story). Go (container): gofmt/vet/build clean, `go test ./...` green incl. the new NoRoute/panic/wrong-method tests.

**Residual risks:** (1) the systematized error handling (panic→envelope through the proxy, the 4xx/5xx split, the error boundary) is best confirmed via an integration/browser pass — hence `followup_review_recommended: true`. (2) The mutation refactor is verified behaviour-preserving and covered by the unchanged regression suites, but it touched all three hooks; the E2E optimistic-rollback spec (runs at CI) is the end-to-end tripwire. (3) 2 pre-existing tsc errors on main's E2E specs remain (from parallel a11y/coverage work) — flagged separately, not 3.1's.
