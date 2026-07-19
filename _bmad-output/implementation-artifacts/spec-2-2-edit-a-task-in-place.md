---
title: 'Edit a task in place'
type: 'feature'
created: '2026-07-19'
status: 'done'
baseline_revision: '7830233'
final_revision: '2397b3079f2ed7916b3d3ff73c44793741b2716d'
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

**Problem:** Todos can be created (title-only) and completed, but never corrected — a typo in a title or a missing description means there is no way to fix a task where it lives. This is also the first place a description can be entered at all.

**Approach:** Web-forward (the backend is already built). Tapping a row's title or description turns the row itself into an **inline editor** (title `<input>` + optional description `<textarea>` + a locked hint). Enter (in the title) or blurring out of the editor saves; Esc cancels and reverts. Saves are optimistic and persist via `PATCH /todos/:id` sending **only the changed fields** (absent = unchanged; an intentional description clear sends `description: ""`). The backend `PATCH` (built in Story 2.1) already implements this pointer-based partial update — 2.2 adds the inline-edit UI, a `useUpdateTodo` optimistic hook, and the title/description backend tests 2.1 deferred.

## Boundaries & Constraints

**Always:**
- The `PATCH` body carries **only the fields that actually changed** (compared trimmed against the prior values). A **no-op** edit issues **no request**. An intentional description clear sends `description: ""` (present, empty); an unchanged field is **omitted** (absent = unchanged, never a zero-value overwrite — AD-6).
- Client mirrors the server validation (AD-10): title trimmed, required (non-empty), ≤200 code points; description trimmed, optional, ≤2000 code points; counted via `[...s.trim()].length`. Save is blocked while the title is empty/whitespace or any field is over cap (RD-3).
- The edit is optimistic: `onMutate` applies the changed fields to the cache by id and snapshots the prior title AND description; `onError` restores them (visible rollback); settle against the server (AD-4). TanStack cache is the sole owner.
- Real form controls (title `<input>`, description `<textarea>`), keyboard-first: **Enter in the title saves**, **Esc cancels/reverts**, **blur that leaves the entire editor saves**. Consume CSS tokens; the client never generates timestamps (AD-7).
- **Locked microcopy (verbatim):** the hint `Enter to save · Esc to cancel` (middle-dot `·` U+00B7) and the description placeholder `Add a description (optional)`.

**Block If:**
- The backend `PATCH` turns out NOT to support the absent-vs-explicit-`""` distinction or title/description partial updates (unexpected — 2.1 built the pointer decode; if it is actually broken that is a 2.1 regression, out of this story's band).

**Never:** No delete/undo (Story 2.3). No char-counter UI (Epic 3 / RD-2 — only the over-cap save-block behavior here, no counter). No modal or route change (edit is strictly in place). No new backend endpoint or migration (the `PATCH` exists). No systematized cross-mutation wrapper (Epic 3 — mirror `useToggleTodo` for now). No client re-sort.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| enter edit | tap title or description text | row becomes the inline editor: title field (seeded + focused if tapped), description field (placeholder if empty), hint shown | — |
| save changed title | edit title, Enter | optimistic title update + `PATCH {title}` (only changed field); editor closes | rollback on reject |
| save changed description | edit description, blur out | optimistic + `PATCH {description}` | rollback on reject |
| clear description | delete all description text, save | optimistic + `PATCH {description:""}` (present, empty — intentional clear) | rollback on reject |
| no-op | open editor, change nothing (or whitespace-only delta), Enter/blur | editor closes, **no PATCH** | — |
| empty title | clear the title, save | rejected inline, reverts to prior title, **no PATCH** | — |
| over cap | title >200 or description >2000 code points | save blocked until back within cap | — |
| cancel | Esc | editor closes, both fields revert to prior values, **no PATCH** | — |
| server rejects | 5xx/network/timeout on a save | row rolls back visibly to pre-edit title AND description + a non-disruptive error | rollback (AC) |
| partial-diff | only title changed | `PATCH` omits `description` (unchanged) — server leaves it intact | — |

</intent-contract>

## Code Map

**Frontend (web):**
- `web/lib/useUpdateTodo.ts` -- **new** optimistic field-edit mutation mirroring `useToggleTodo`: `updateTodoMutationKey`; input `{id, patch: UpdateTodoRequest}`; `onMutate` cancel→snapshot `{prevTitle, prevDescription}`→`setQueryData` apply `patch` by id; `onError` restore both fields by id; `onSuccess` swap server row by id; `onSettled` gated `isMutating===1` invalidate.
- `web/app/components/TodoRow.tsx` -- add inline edit mode: `editing` state + `titleDraft`/`descDraft`; tapping the title `<p>` or description `<p>` enters edit and focuses the tapped field; render the editor (title `<input>` single-line, description `<textarea>` multiline, hint line) replacing the display text; the checkbox stays; Enter-in-title/blur-out-of-editor saves, Esc reverts. Build the changed-fields patch (trimmed per-field diff), block save on empty title / over cap, close on save/cancel. Mirror `AddInput`'s `codePoints`/`MAX_TITLE` (+`MAX_DESCRIPTION=2000`).
- `web/lib/todos.ts`, `shared/todo.ts` -- reuse `updateTodo(id, patch)` + `UpdateTodoRequest {title?,description?,status?}` (both already support present-`""` vs omitted). No change.
- `web/app/globals.css` -- consume existing tokens (`--accent`, `--accent-soft`, `--surface-raised`, `--ink-primary/secondary`, `--radius-sm`, `--border-hairline`, `--space-*`). No new tokens.

**Backend (api) — NO new code, tests only (the C-section 2.1 deferred):**
- `api/handler/handler_test.go` -- PATCH `{title}` → 200 + updated title; PATCH `{"description":""}` decodes to a **non-nil** `*string("")` reaching the service (assert), and an omitted description → `nil` (unchanged).
- `api/service/service_test.go` -- `UpdateTodo` with `description=&""` forwards non-nil empty (clear, no error); description over-cap (2001) → `ValidationError` pre-repo; empty/whitespace title → `ValidationError`, repo not called.

**Frontend tests:**
- `web/tests/use-update-todo.test.tsx` -- **new**: optimistic title edit + `PATCH {title}`; description clear → `PATCH {description:""}` (key present, empty); rollback on 5xx restores prior title AND description.
- `web/tests/todo-row.test.tsx` -- additions: tap title → editor (hint + placeholder visible); no-op edit → 0 PATCH; empty-title save → revert + 0 PATCH; Esc → revert + 0 PATCH; description clear → `PATCH {description:""}` (title omitted).
- `web/tests/e2e/edit.spec.ts` -- **new** `@p0`: tap → edit title → Enter → `PATCH` (only changed field) observed → reload persists; clear description → `PATCH {description:""}`; rollback on route-forced 500 reverts pre-edit values; no-op → no PATCH.

## Tasks & Acceptance

**Execution:**
- [x] `web/lib/useUpdateTodo.ts` -- optimistic field-edit mutation (snapshot prior title+description, id-based rollback).
- [x] `web/app/components/TodoRow.tsx` -- inline editor (title input + description textarea + locked hint/placeholder), tap-to-edit + focus, Enter/blur-save + Esc-revert, editor-scoped blur, trimmed per-field diff → changed-fields patch, empty-title/over-cap save block, no-op guard.
- [x] `web/tests/use-update-todo.test.tsx`, `web/tests/todo-row.test.tsx` -- edit + no-op + empty-title + Esc + clear-description + rollback coverage.
- [x] `web/tests/e2e/edit.spec.ts` -- E2E edit/persist/clear/rollback/no-op (written; run at CI/PR gate).
- [x] `api/handler/handler_test.go`, `api/service/service_test.go` -- the deferred title/description PATCH tests (title update→200; `description:""` non-nil decode + omitted→nil; description over-cap→400; empty title→400).

**Acceptance Criteria:**
- Given a todo, when I tap its title or description, then the row becomes an inline editor (title field + optional description field + hint `Enter to save · Esc to cancel`).
- Given the inline editor, when I confirm with Enter or blur, then the change applies optimistically and persists via `PATCH /todos/:id` sending only the changed fields; pressing Esc reverts to the prior values.
- Given the editor opened but nothing changed, when I confirm, then no `PATCH` is issued.
- Given an edit leaving the title empty/whitespace, when I save, then it is rejected and reverts to the prior title; clearing the description is accepted and persisted by sending `description: ""` explicitly.
- Given the server rejects an edit, then the row rolls back visibly to its pre-edit values.

## Design Notes

Resolutions of the planning flags (conservative, grounded — for PR ratification):

1. **Editor-scoped blur (not per-field).** "Save on blur" fires only when focus leaves the entire editor (check `relatedTarget` is outside the editor container). Tabbing title→description does NOT save. Prevents a mid-edit field switch from closing the editor.
2. **Title `<input>` (Enter=save), description `<textarea>` (Enter=newline).** The display preserves newlines (`white-space: pre-wrap`) and description allows ≤2000 code points, so the description editor is multiline; Enter there inserts a newline. Saving a description happens on blur-out or via Enter in the title (which saves the whole editor). Esc always reverts both.
3. **Description field always renders in edit mode** (with the locked placeholder) so a todo with no description can gain one — the tap target for such a row is the title.
4. **Focus the tapped field** on entering edit (title tap → focus title; description tap → focus description).
5. **Checkbox stays visible/functional** in edit mode (it is outside the text); the more/less reveal is replaced by the editor (full text lives in the field).
6. **No-op + partial diff:** drafts are trimmed and compared per-field to the prior values; only changed fields go into the patch; if the patch is empty → no request. A description cleared to `""` is a change (sends `description:""`); an untouched field is omitted.
7. **Locked microcopy verbatim:** `Enter to save · Esc to cancel` and `Add a description (optional)`.

`useUpdateTodo` shape (mirrors `useToggleTodo`; rollback restores BOTH fields for a uniform context):
```ts
onMutate: ({id, patch}) => { cancelQueries; const p = cache.find(id); setQueryData(map t.id===id ? {...t, ...patch} : t); return {id, prevTitle: p.title, prevDescription: p.description}; }
onError:  (_e,_v,ctx) => setQueryData(map t.id===ctx.id ? {...t, title: ctx.prevTitle, description: ctx.prevDescription} : t)
onSuccess:(srv,_v,ctx)=> setQueryData(map t.id===ctx.id ? srv : t)
onSettled:()          => { if (isMutating({mutationKey: updateTodoMutationKey})===1) invalidateQueries }
```

## Verification

**Commands:**
- `cd web && npm run test:unit && npm run lint && npm run format:check && npx tsc --noEmit` -- all green.
- api (container): `gofmt -l .` clean, `go vet ./...`, `go build ./...`, `go test ./...` green (new title/description PATCH tests).
- `cd web && npm run test:e2e:p0` -- edit specs green (test-compose stack).

**Manual checks:**
- `docker compose up` → tap a task's title: it becomes an editor with the hint; change the title + Enter → updates and persists on reload; tap again, clear the description, blur → `PATCH {description:""}` clears it; open an editor and press Esc → reverts; empty the title + Enter → reverts, no write; force a `PATCH` 500 → the row reverts to pre-edit values + error.

## Review Triage Log

### 2026-07-19 — Expert review pass (Gopher [Go] + Pixel [web])
- intent_gap: 0
- bad_spec: 0
- patch: 3 (medium 2, low 1)
- defer: 0
- reject: 2 (P4 over-cap dangling editor — correct per RD-3; Gopher's optional 200/echo assertions — tests already mutation-verified sound)
- addressed_findings:
  - `[medium]` `[patch]` P1 — keyboard users couldn't ENTER edit mode (tap target was a click-only `<p>`). Made the title/description tap targets focusable (`role="button"` + `tabIndex` + `onKeyDown` Enter/Space) + added a keyboard-entry test.
  - `[medium]` `[patch]` P3 — the editor-scoped blur logic (trickiest branch) had zero tests. Added unit tests: blur-within-editor (title→description) stays open + 0 PATCH; blur-out saves.
  - `[low]` `[patch]` P2 — a null `relatedTarget` from a WINDOW/tab blur committed + closed the editor mid-edit. Guarded with `if (!next && !document.hasFocus()) return;` so only an in-page focus move out of the editor saves.
- Gopher (Go, TEST-ONLY slice): verdict SOUND — **mutation-tested the crux** (injected the `""`→nil collapse into handler.go and service.go; the tests caught both). The absent-vs-`""` decode, empty/whitespace-title rejection, and description over-cap boundary are all correctly + non-tautologically pinned. Optional 200/echo assertions rejected (polish, not a gap).
- Pixel (web): the data-integrity core (AD-6 per-field diff — clear→`{description:""}`, unchanged omitted, no zero-value overwrite — and AD-4 id-scoped rollback) verified solid and well-tested. Findings were all around blur/keyboard edges (P1/P2/P3), now fixed.

## Auto Run Result

Status: done

**Summary:** Story 2.2 (edit a task in place) implemented web-forward (backend PATCH built in 2.1). Tapping a row's title/description turns the row into an inline editor (title `<input>` + optional description `<textarea>` + locked hint); Enter/blur-out saves, Esc reverts. Saves are optimistic (`useUpdateTodo`, id-based rollback of both fields) and PATCH only changed fields — a no-op sends nothing, an intentional `description:""` clear is sent present, an unchanged field omitted (AD-6). Backend unchanged (2.1's pointer PATCH already supported this); added the title/description PATCH tests 2.1 deferred. Two-expert review (Gopher + Pixel) → 3 patches, 2 rejects, 0 intent-gaps, 0 bad-spec loopbacks.

**Files changed:** web — `lib/useUpdateTodo.ts` (new), `app/components/TodoRow.tsx` (inline editor + keyboard entry + window-blur guard), `tests/use-update-todo.test.tsx` (new), `tests/todo-row.test.tsx` (edit + blur + keyboard tests), `tests/e2e/edit.spec.ts` (new). api (tests only) — `handler/handler_test.go`, `service/service_test.go` (title/description PATCH + absent-vs-`""` decode).

**Review findings:** 3 patches (2 medium, 1 low), 0 deferred, 2 rejected, 0 intent-gaps, 0 bad-spec loopbacks.

**Verification:** web `npm run test:unit` → 50 passed; eslint + prettier + tsc clean. Go (container): gofmt/vet/build/test green. Playwright E2E (`edit.spec.ts`) runs at CI / the docker test stack (not on host).

**Residual risks:** (1) the editor-scoped blur incl. the window-blur guard and keyboard entry are best confirmed in a real browser (jsdom can't fully exercise window-focus / focus-visible) — covered by the E2E at CI, hence `followup_review_recommended: true`. (2) Caret-at-end vs select-all on entering edit is a conservative untested detail (Design Note flags select-all as the epic's "selection highlighted" wording — trivially changeable at PR).
