---
baseline_commit: 444c7c8
---

# Story 1.2: Create a todo (optimistic, end-to-end)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to type a title and hit Enter to add a task that instantly appears at the top,
so that I can dump tasks as fast as I think of them.

## Acceptance Criteria

> ACs 1–6 are lifted verbatim from `epics.md` Story 1.2 (the epic contract). ACs 7–9 are the Epic-1 test-design gate that this story turns on — Story 1.1 explicitly deferred **full `shared/` ↔ Go contract enforcement** and the **injection/validation P0 tests** to "when `POST` lands" (see 1.1 Task 8 note + `shared/todo.ts` header). This is that story. Same structure as 1.1 (epic contract + test gate).

**AC1 — Optimistic insert at top, input clears + keeps focus**
**Given** the pinned, focused add-input
**When** I type a valid title and press Enter (or click Add)
**Then** the todo is inserted optimistically at the top in ≤100ms with a temporary id
**And** the input clears and keeps focus for rapid entry.

**AC2 — Temp-id swap on the 201, server-authoritative shape**
**Given** an optimistic add
**When** `POST /todos` returns `201` with the full resource
**Then** the client swaps the temp id for the server-generated UUID
**And** the row reflects server-set `status=active` and timestamps (camelCase wire shape, timestamps nested under `metadata`).

**AC3 — Empty/whitespace title rejected inline, no request sent**
**Given** an empty or whitespace-only title
**When** I submit
**Then** it is rejected inline within the same interaction, no row is created, and focus is retained
**And** no request is sent to the server.

**AC4 — Server-authoritative validation (rune caps, trim, boundaries, server-assigned fields)**
**Given** the server as the authoritative validator
**When** a create is validated
**Then** `title` is required and ≤200 code points and `description` is optional and ≤2000, with whitespace trimmed before validation on both client and server (cap applied after trim)
**And** a title of exactly 200 code points is accepted while 201 is rejected (boundary inclusive), counting by Unicode code point (a multi-code-point grapheme counts as more than one)
**And** a server-side validation failure returns `{ error: { code: "validation_error", message } }` with HTTP `400`
**And** the server assigns `id`/`status`/timestamps and ignores any client-supplied `id`/`status`/`metadata`.

**AC5 — Double-add guard**
**Given** the add-input
**When** I submit the same input twice in rapid succession (e.g. Enter pressed twice)
**Then** exactly the intended number of todos is created (the optimistic add is guarded against an accidental double-add).

**AC6 — Add-path rollback, no silent divergence**
**Given** an optimistic add
**When** the server rejects it (5xx/network/timeout)
**Then** the phantom row rolls back visibly (add-path rollback)
**And** there is no silent divergence between what is shown and what is persisted.

**AC7 — Contract-drift guard turned on [R3 / AD-6 enforcement]**
**Given** the single source-of-truth wire type in `shared/todo.ts`
**When** the Go wire serializer (`api/handler/wire.go`) diverges from it (field name, casing, `metadata` nesting, or `""`-not-`null`)
**Then** an automated contract test fails (build/CI red) — the two sides can no longer drift silently
**And** the Playwright integration contract test (`assertTodoShape`) passes against a real `POST`ed + `GET`-listed resource.

**AC8 — Injection is inert [R4 / AD-10]**
**Given** server-side sanitization is the only safety net (no auth in v1)
**When** a create is submitted with a SQL-injection payload as the title (e.g. `'; DROP TABLE todos; --`)
**Then** it is stored as literal text or rejected as too-long — it never executes
**And** a follow-up `GET /todos` still succeeds and returns a valid array (the table is intact).

**AC9 — P0 test suite wired + green (Epic-1 quality gate)**
**Given** the drop-in test framework (`_bmad-output/test-artifacts/framework-design/`)
**When** it is copied into `web/` and `api/` and run
**Then** the P0 create specs pass: `1.2-INT-001/002` (contract), `1.4-E2E-001..004` (core loop), `3.2-E2E-001` (add rollback), and the Go create tests (valid→201 AD-6, empty→400, injection inert)
**And** web-unit tests cover the rune-count mirror and the optimistic-rollback logic
**And** the committed quality gate stays green (`eslint`+`prettier` web; `gofmt`+`go vet`+`golangci-lint` api).

## Tasks / Subtasks

- [x] **Task 1 — `api` repository: `CreateTodo`** (AC: 2, 4, 8)
  - [x] Add `CreateTodo(ctx, title, description string) (model.Todo, error)` to the `Repository` interface in `api/repository/repository.go` (keep the AD-2 seam clean — **no `user_id`/scope param**).
  - [x] Implement on `*Postgres` with a **parameterized** `INSERT INTO todos (title, description) VALUES ($1, $2) RETURNING id, title, description, status, created_at, updated_at`. The DB defaults assign `id` (`gen_random_uuid()`), `status` (`'active'`), and both timestamps (`now()`) — do **not** send them from Go (AD-7). Scan the returned row into `model.Todo` (native `time.Time`, same as `ListTodos`).
  - [x] SQL stays inside `repository/` only; never string-concatenate the payload (AC8 / AD-10).

- [x] **Task 2 — `api` service: `CreateTodo` + validation** (AC: 4, 8)
  - [x] Add `CreateTodo(ctx, title, description string) (model.Todo, error)` to `api/service/service.go`. **No Gin import** (AD-1).
  - [x] Validate **server-authoritatively** (AD-10): `strings.TrimSpace` both fields **first**, then check `title` non-empty and `utf8.RuneCountInString(title) <= 200`; `utf8.RuneCountInString(description) <= 2000`. Cap is applied **after** trim.
  - [x] On failure, return a typed validation error (e.g. a package-level `ErrValidation` sentinel or a `ValidationError` type carrying a message) that the handler maps to `400 validation_error`. Do **not** return raw strings the handler has to sniff.
  - [x] Persist the **trimmed** values (so optimistic client text == persisted text). Pass trimmed title + trimmed description to `repo.CreateTodo`.
  - [x] Keep the AD-8 status allow-list authority here (already `model.StatusActive/StatusCompleted`); create always yields `active` via the DB default — the service does not accept a client `status`.

- [x] **Task 3 — `api` handler: `POST /todos`** (AC: 2, 4)
  - [x] Register `r.POST("/todos", createTodo(svc))` in `NewRouter` (`api/handler/handler.go`) and add `CreateTodo(ctx, title, description string) (model.Todo, error)` to the handler's local `TodoService` interface.
  - [x] Bind the body into a struct with **only** `Title string` + `Description string` (`json:"title"` / `json:"description"`) so any client-supplied `id`/`status`/`metadata` is **ignored** (AC4). Use `c.ShouldBindJSON`. `description` absent → `""` (Go zero value) — matches AD-6 "`""` never `null`".
  - [x] Map results: validation error → `c.JSON(400, model.NewAPIError(model.CodeValidationError, msg))`; other error → `500 internal_error`; success → `c.JSON(201, toTodoResponse(created))` (**reuse the existing serializer** in `api/handler/wire.go` — do not hand-build the JSON).

- [x] **Task 4 — `web` data layer: `createTodo` + optimistic mutation** (AC: 1, 2, 5, 6)
  - [x] Add `createTodo(input: CreateTodoRequest): Promise<Todo>` to `web/lib/todos.ts` — `POST /api/todos` (same-origin, dumb proxy already routes POST), `throw` on `!res.ok` so the mutation's `onError` fires. **Reuse the existing `CreateTodoRequest`/`Todo` types from `@shared/todo`** — do not redeclare shapes.
  - [x] Add a `useCreateTodo` mutation hook (recommend `web/lib/useCreateTodo.ts`) built on `useMutation`, shaped so Epic 2 (edit/toggle/delete) and Epic 3's systematized R1 wrapper can extend it — **not a one-off**:
    - `onMutate`: `await queryClient.cancelQueries({ queryKey: todosQueryKey })`; snapshot `const prev = queryClient.getQueryData<Todo[]>(todosQueryKey)`; build an optimistic `Todo` with a **temp id** (`crypto.randomUUID()`, treated as temporary), `status: 'active'`, trimmed `title`, `description`, and a placeholder `metadata` (swapped on settle — see AD-7 note in Dev Notes); **prepend** it via `setQueryData` (matches server newest-first); return `{ prev, tempId }`.
    - `onError`: `queryClient.setQueryData(todosQueryKey, ctx.prev)` → visible rollback; surface a minimal non-disruptive error (AC6).
    - `onSuccess(server, _vars, ctx)`: **swap** the temp row for the server resource — `setQueryData(prev => prev.map(t => t.id === ctx.tempId ? server : t))` (temp id → real UUID, adopt server `status`/`metadata`).
    - `onSettled`: `queryClient.invalidateQueries({ queryKey: todosQueryKey })` as the reconciliation backstop (guarantees UI == server, closing "no silent divergence").

- [x] **Task 5 — `web` AddInput component + client validation mirror** (AC: 1, 3, 5)
  - [x] Create `web/app/components/AddInput.tsx`: a **real `<form>`** with a real `<input>` (placeholder **"Add a task…"** verbatim) and a real pill `<button type="submit">Add</button>` (semantic controls — UX-DR27). Controlled value.
  - [x] **Focus on load and re-focus after every successful add** (a `ref` + `useEffect` / focus after `mutate`). Pinned at the top of the column, above the list.
  - [x] Submit handler (fires on Enter **and** Add click via the form): `const t = value.trim();` mirror the server rules (AD-10) — if `t === ''` → reject inline, **retain focus, send no request** (AC3, test `1.4-E2E-002` asserts `postSeen === false`); if `[...t].length > 200` (code-point count, **spread/`Array.from`, not `.length`** — matches Go rune count) → block submit (RD-3: over-cap typing is allowed, keystrokes never dropped, but submit is blocked until back within cap).
  - [x] **Double-add guard (AC5):** on a valid submit, **clear the input synchronously** (`setValue('')`) before/independently of the async mutation, so a second Enter microseconds later hits the empty-title guard and is rejected. Do **not** disable the input (would break rapid type-Enter-type-Enter). Each valid submit fires exactly one `mutate`.
  - [x] The visible char counter is **out of scope** (Epic 3 / Story 3.3, UX-DR6, RD-2) — implement the submit-blocking cap behavior only, no counter UI.

- [x] **Task 6 — Wire AddInput into the page** (AC: 1, 2, 6)
  - [x] Render `<AddInput />` in `web/app/page.tsx` between the header and the list body, at every state (empty/loading/list) — it is the pinned CTA (UX-DR15: the focused add-input sits above the empty state).
  - [x] The optimistic add prepends into the TanStack cache, so the existing minimal `<ul>`/`<li>` list (title-only) will render the new row at top. Full row anatomy (description clamp, relative time, newest-first guarantees) stays **Story 1.3** — do not build it here. Ensure the empty→list transition still works when the first todo is added.
  - [x] On add rejection, show a minimal non-disruptive error (reuse the page's existing warm error affordance or a small toast); the polished/systematized error + 4xx/5xx split is Epic 3 (Stories 3.1/3.2). Test `3.2-E2E-001` needs the phantom row gone **and** an error message visible (matches `/couldn.t|try again|something got in the way/i`).

- [x] **Task 7 — Contract-drift guard [R3 / AC7]** (AC: 7)
  - [x] Add a Go test that fails on drift from `shared/todo.ts`: marshal a sample `toTodoResponse(...)` and assert the exact JSON key set — top-level `id,title,description,status,metadata` and nested `metadata.{createdAt,updatedAt}`, camelCase, no `snake_case` leak, `description` serializes `""` not `null`. Co-locate with `api/handler/` tests.
  - [x] Confirm the Playwright integration contract test (`assertTodoShape`) exercises a real `POST`→`GET` round-trip (`1.4-INT-001`).
  - [x] Update the `shared/README.md` note: contract enforcement now **landed** (was "Story 1.2 follow-up").

- [x] **Task 8 — Drop in + wire the test framework** (AC: 8, 9)
  - [x] Copy `_bmad-output/test-artifacts/framework-design/web/*` → `web/` and `.../api/*` → `api/` per that README's drop-in steps (playwright.config, vitest already exists — merge, support fixtures, e2e/integration specs, `api/todos_test.go`).
  - [x] `cd web && npm i -D @playwright/test @faker-js/faker && npx playwright install` (Vitest/RTL already installed in 1.1). Merge `web/package.scripts.md` scripts (`test:e2e`) into `package.json`.
  - [x] Implement the `newTestClient` helper the Go samples sketch (`api/todos_test.go` uses `c.post/getList/resetTodos`, `uuidV4`, `rfc3339Z`) against the compose test profile; reuse `api/testhelpers/seed.go` (`testseed` build tag) for reset.
  - [x] Add web-unit (Vitest) tests: rune-count mirror (`[...s].length` boundary 200/201, incl. a multi-code-point emoji) and the optimistic add `onMutate`/`onError`/`onSuccess` snapshot-restore-swap logic.
  - [x] **Test-cleanup dependency — resolve before green:** `fixtures.ts` `resetTodos` calls `DELETE /api/todos/:id`, but `DELETE` is **Epic 2 (Story 2.3)** — not implemented here. Choose one (see Dev Notes "Test-cleanup gap"): (a) **recommended** — add a `testseed`-guarded, prod-unreachable reset route (e.g. `POST /internal/test/reset`) wired to `testhelpers.ResetTodos`, and point web `resetTodos` at it; or (b) run create E2E against an ephemeral DB reset per run. Do **not** implement the real `DELETE /todos/:id` here (that is 2.3's contract, undo window and all).

- [x] **Task 9 — Quality gate + end-to-end proof** (AC: 1–9)
  - [x] Run: `cd web && npm run lint && npm run format:check && npm run test:unit && npm run test:e2e`; `cd api && gofmt -l . && go vet ./... && golangci-lint run && go test ./... && go test -tags testseed ./...`. All green.
  - [x] Live proof via `docker compose up`: type a title → row at top ≤100ms, input clears+refocuses; reload → row persists (durable); empty submit → no row, no POST (check network); force a `POST` 500 → row rolls back + error shown; `POST` a 201-char title → `400 validation_error`, a 200-char title → `201`.

## Dev Notes

### Scope discipline (what this story IS and is NOT)
This is the **create end-to-end** story — the second of three foundation stories. It lands `POST /todos` (api) + the optimistic add UI (web) + turns on the contract/injection P0 gates.
- **IN scope:** `POST /todos` (repository→service→handler), server-authoritative validation (trim + rune caps), the pinned/focused AddInput, optimistic prepend + temp-id swap + add-path rollback, double-add guard, the `shared/`↔Go contract-drift test, injection test, and dropping in + wiring the test framework so the Epic-1 R3/R4 gates go green.
- **NOT in scope:** full list row anatomy — description clamp/"more", relative-time render, newest-first tiebreak assertions (**Story 1.3**); edit/toggle/delete + `PATCH`/`DELETE` (**Epic 2** — do not implement `DELETE` even for test cleanup, see Task 8); the **visible char counter** UI, skeleton shimmer, warm error illustration, the systematized cross-mutation rollback wrapper + React error boundary hardening, theme toggle (**Epic 3**).
- **Foreshadow, don't over-build:** shape the add mutation's `onMutate/onError/onSuccess/onSettled` so Epic 2's edit/toggle/delete and Epic 3's R1 wrapper (score-9 risk) extend it. A clean `useCreateTodo` hook is enough — do not build the generic four-path wrapper now.

### What already exists (reuse — do NOT reinvent)
Story 1.1 built the full skeleton; the `POST` path slots into a ready seam. Read these before writing:
- **`shared/todo.ts`** — `Todo`, **`CreateTodoRequest { title; description? }`**, `UpdateTodoRequest`, `ApiError`, `TodoStatus`, `TODO_STATUSES`. **Use `CreateTodoRequest` for the POST body.** The Go side must match this (AC7).
- **`api/handler/handler.go`** — `NewRouter(svc)` registers `GET /health`, `GET /todos`; local `TodoService` interface (extend it). Pattern for error mapping already present (`model.NewAPIError`).
- **`api/handler/wire.go`** — **`toTodoResponse(model.Todo) todoResponse`** already produces the exact AD-6 wire shape (camelCase, `metadata` nesting, RFC3339-`Z` second precision). **Reuse it for the 201 body.**
- **`api/service/service.go`** — `Service` over `repository.Repository`; `New(repo)`. Add `CreateTodo` here; validation lives here (AD-1).
- **`api/repository/repository.go`** — `Repository` interface + `*Postgres` (`pgxpool`). `ListTodos` shows the parameterized-query + `time.Time` scan pattern to mirror for the INSERT…RETURNING.
- **`api/model/todo.go`** — flat `Todo` (native `time.Time`, no json tags), `StatusActive/StatusCompleted`, `NewAPIError`, `CodeValidationError/CodeNotFound/CodeInternalError`.
- **`api/migrations/000001_create_todos.up.sql`** — the table already has `id DEFAULT gen_random_uuid()`, `description DEFAULT ''`, `status DEFAULT 'active' CHECK (status IN ('active','completed'))`, `created_at/updated_at DEFAULT now()`. **No new migration needed** — INSERT (title, description) and let the DB assign the rest.
- **`web/app/api/[...path]/route.ts`** — the dumb proxy **already exports `POST` (and PATCH/PUT/DELETE)**. **No proxy change needed** for `POST /todos`.
- **`web/lib/todos.ts`** — `fetchTodos`, `todosQueryKey = ['todos']`. Add `createTodo` alongside; reuse `todosQueryKey`.
- **`web/app/providers.tsx`** — `QueryClient` (queries `staleTime 5_000`, `retry 1`). Mutations added in the hook.
- **`web/app/page.tsx`** — `useQuery` list with loading/error/empty/minimal-list branches. Insert `<AddInput />`; the optimistic prepend renders in the existing `<ul>`.
- **`web/app/globals.css`** — token CSS vars: `--surface-raised`, `--accent`, `--accent-soft`, `--ink-primary`, `--ink-secondary`, `--border-hairline`, `--on-accent`, `--radius-sm/md/full`, `--shadow-row`, `--font-sans`, `--space-*`. **Consume these** for AddInput styling — do not hardcode hexes.

### Architecture guardrails (binding — AD-1…AD-12; full rationale in ARCHITECTURE-SPINE.md)
- **AD-1 layering:** validation + trim + rune-count live in `service/`; HTTP status mapping + JSON binding in `handler/`; INSERT in `repository/` only. Never import Gin in the service; never write SQL in the handler. [Source: ARCHITECTURE-SPINE.md#AD-1]
- **AD-2 repository seam:** `CreateTodo` on the interface stays clean — **no `user_id`/scope param**. [#AD-2]
- **AD-4 TanStack owns server state:** the new todo lives in the query cache only; `onMutate` optimistic apply is **always** paired with `onError` visible rollback; settle against the server. No component keeps a private list. [#AD-4]
- **AD-6 wire contract:** POST body `{ title, description? }`; server assigns `id`/`status`/`metadata` and **ignores** client copies; `201` + the full resource; camelCase; `metadata` nesting; `description` `""` never `null`. Enforced from `shared/todo.ts` (AC7). [#AD-6]
- **AD-7 server-authoritative identity/time:** `id` = DB UUID v4; client mints a **temp id**, swaps in the real UUID from the `201` on settle — temp ids never persisted. `createdAt/updatedAt` server-set RFC3339-`Z` second precision. **The client never generates the authoritative timestamp.** *Optimistic-render note:* before the `201` arrives the optimistic row has no server timestamp — carry a **placeholder** purely for local render, and **swap the whole row** for the server resource in `onSuccess`. The placeholder is never persisted and never trusted past settle; this respects AD-7 (server value wins). Relative-time render itself is Story 1.3. [#AD-7]
- **AD-9 error contract:** validation → `400 { error: { code: "validation_error", message } }`; unexpected → `500 internal_error`. Client 4xx/5xx **split** (4xx inline no-retry / 5xx error+retry) is systematized in **Epic 3** — here a minimal non-disruptive error on add-reject is enough. [#AD-9]
- **AD-10 validation mirror:** server is authoritative, client mirrors for instant feedback (never the sole gate). **Trim before validating, cap after trim, count Unicode code points (runes).** Go: `utf8.RuneCountInString(strings.TrimSpace(s))`. JS: `[...s.trim()].length` (spread/`Array.from` — **not** `.length`, which counts UTF-16 units and would miscount astral chars). Both count code points, so a multi-code-point grapheme (e.g. an emoji ZWJ sequence) counts as >1 on both sides — the mirror stays exact. `title` ≤200, `description` ≤2000; boundary **inclusive** (200 ok, 201 rejected). [#AD-10]
- **AD-11:** no schema change → **no new migration** (the table + defaults already exist). Do not add one. [#AD-11]

### Double-add guard — the mechanism (AC5)
The input **clears + refocuses on submit**, which is itself most of the guard: a second Enter lands on an empty field → empty-title reject → no POST. Make it robust: in the submit handler, read+trim the current value, reject if empty/over-cap (no request), else **`setValue('')` synchronously** and fire exactly one `mutate`. Never key the guard on a "submitting" disabled state (that would block the intended type-Enter-type-Enter rapid capture UX — UX-DR22/DR5). Test `1.4-E2E-002` proves the empty case sends nothing; the rapid-double-Enter case must still net exactly the intended count.

### Test-cleanup gap (resolve in Task 8 — do not skip)
The drop-in `web/tests/support/fixtures.ts` `resetTodos` deletes via `DELETE /api/todos/:id`, and `seedTodos` auto-cleans with it. **`DELETE` is Story 2.3 (Epic 2)** and must not be built here. Without a cleanup path, seeded E2E/integration tests leak rows and break parallel isolation. **Recommended:** add a `//go:build testseed`-guarded, **prod-unreachable** reset route (e.g. `POST /internal/test/reset`) delegating to the existing `api/testhelpers/seed.go` `ResetTodos`, register it only in the test build, and point web `resetTodos` at it. This keeps TC1 (test seam never prod-reachable) intact and unblocks the P0 suite without pulling Epic-2 scope forward. [Source: project-context.md#Testing-Rules; framework-design/README.md#drop-in step 3]

### UX spec for AddInput (visual = DESIGN.md, behavior = EXPERIENCE.md)
- Raised `surface-raised` field, `radius-sm`, focused resting state = **1.5px `accent` border + `accent-soft` focus-ring halo**; placeholder text in `ink-secondary`, typed text `ink-primary`, `input` type scale (16px/400). [DESIGN.md#Add-input]
- Pill **Add** button: `accent-soft` fill, `accent` text, `radius-sm` — an **equal** alternative to Enter (no primary/secondary hierarchy of outcome). [DESIGN.md#Add-button, EXPERIENCE.md#Add input]
- Pinned top of column, **focused on load, re-focused after every add**; new task "pops to top" directly below the input (motion decorates, never gates the ≤100ms optimistic render — UX-DR18/DR19). A bouncy entrance is a nice-to-have; the perf floor wins. [EXPERIENCE.md#Interaction Primitives]
- **Locked microcopy (verbatim):** placeholder **"Add a task…"**. No other new strings this story. [EXPERIENCE.md#Voice and Tone; UX-DR25]
- Responsive: single centered column, `max-width ~560px`, functional from ~375px up (already established in `page.tsx`). [DESIGN.md#Layout]
- **Semantic controls (UX-DR27 a11y floor):** real `<form>`/`<input>`/`<button>` (Playwright specs locate by `getByPlaceholder('Add a task…')` and `getByRole('listitem')`). Recommended stable hooks if roles are insufficient: `add-input`, `add-button` (from the test-design data-testid list). Full screen-reader/`aria-live` coverage is deferred (UX-DR28).

### Previous story intelligence (Story 1.1 — read before starting)
- **Go toolchain isn't on the host.** 1.1 ran `go mod tidy`/`vet`/`test`/`gofmt`/build-tag builds **inside `golang:1.26-alpine`**. `pgx/v5 v5.10.0` needs Go ≥1.25; module is `go 1.26`. Expect to run Go commands in a container (or `docker compose run`), not bare on macOS.
- **golangci-lint** is committed (`api/.golangci.yml`, v2). Keep it green (0 issues) — it is part of the gate.
- **Timestamps live in the serializer** (`wire.go`), not the domain model — this is deliberate (a re-review refactor). Do not move json tags onto `model.Todo`.
- **1.1 deferred, now due here:** full `shared/`↔Go contract enforcement (AC7) and the injection/validation P0 tests (AC8/AC9). `shared/README.md` and `model/todo.go` both say "from Story 1.2."
- **1.1 deferred-work still latent (`deferred-work.md`) — one may bite:** `fetchTodos` calls `res.json()` unconditionally; a `POST` that returns a non-JSON/empty 2xx would throw. `POST /todos` always returns a JSON body (`201`+resource or `4xx/5xx`+envelope), so `createTodo` is fine calling `res.json()` on `res.ok` — but do **not** call `res.json()` on a `204` (none here). The other three deferred items (proxy redirect, boot timeouts, HEAD/OPTIONS) don't touch this story.
- Verification bar 1.1 set: browser-verified live + durability (`down`/`up`) + full gate. Match it (Task 9).

### Git intelligence
Recent commits: `444c7c8` (merge 1.1) ← `86b8e1c` (walking skeleton). The skeleton commit added exactly the files listed above under "What already exists." No `POST`/mutation/AddInput code exists yet — you are adding, not refactoring. Baseline for this story = `444c7c8`.

### Latest tech / library specifics
Manifests exist — **the code owns the versions; read them, don't assume.** Confirmed in-repo: `next ^16.2.10`, `react ^19.2.0`, `@tanstack/react-query ^5.101.0`, Go `1.26`, `gin v1.12.0`, `golang-migrate v4.19.1`, `pgx/v5 v5.10.0`. Story-critical API notes:
- **TanStack Query v5 optimistic pattern** (the crux): `useMutation({ onMutate, onError, onSuccess, onSettled })`. In `onMutate` call `await queryClient.cancelQueries({ queryKey })` (prevents an in-flight `GET` from clobbering the optimistic write), snapshot with `getQueryData`, apply with `setQueryData`, and **return** the snapshot as context; `onError(err, vars, context)` restores it. v5 uses the **object** signature (`{ queryKey }`), `isPending` (not `isLoading`), and a single `status` discriminated union. [Consistent with `providers.tsx`/`page.tsx` already using v5 object API.]
- **Code-point counting:** `[...str].length` / `Array.from(str).length` iterate by code point (UTF-16 surrogate pairs collapse to 1); `str.length` counts UTF-16 units. Go `utf8.RuneCountInString` counts runes (= code points). These agree — use them to keep the AD-10 mirror exact. (Neither counts grapheme clusters, which is correct per AC4: "a multi-code-point grapheme counts as more than one.")
- **`crypto.randomUUID()`** is available in the browser for the temp id (or any collision-safe temp marker); it is swapped out on settle, never persisted.

### Project Structure Notes
- New files land inside the existing Structural Seed — no new top-level dirs. `web/app/components/AddInput.tsx`, `web/lib/useCreateTodo.ts`, `web/lib/todos.ts` (extend). Go: extend `handler.go`/`service.go`/`repository.go` in place; add `handler/*_test.go` for the contract test; add `api/todos_test.go` + test-client helper.
- No variance from architecture expected. The one **decision** to make + document: the test-reset path for web E2E (Task 8 / "Test-cleanup gap") — record the chosen approach in the story's Dev Agent Record and, if a route is added, note its `testseed`-only guard.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2] — the 6 epic ACs, FR1–FR4/FR16/FR18/FR23 coverage, resilience-floor split rationale.
- [Source: _bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md] — AD-1/2/4/6/7/9/10/11, Capability→Architecture map (Feature A = web mutation + api POST).
- [Source: _bmad-output/project-context.md] — condensed binding rules + anti-patterns (rune counting, trim-before-cap, ignore client id/status/metadata, prepend-not-resort, optimistic+rollback, parameterized SQL, derive from `shared/`).
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-todo-app-2026-07-17/DESIGN.md] — add-input/add-button visual spec, tokens, type scale, layout.
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-todo-app-2026-07-17/EXPERIENCE.md] — add-input behavior, "pops to top", keyboard core loop, locked microcopy, optimistic-rollback state.
- [Source: _bmad-output/specs/spec-todo-app/resolved-decisions.md] — RD-3 (over-cap typing: allow keystrokes, block submit until within cap); RD-1 (relative-time buckets — Story 1.3).
- [Source: _bmad-output/test-artifacts/test-design/todo-app-handoff.md] — P0 scenarios 1.2 (POST 201/empty-400/injection) + 1.4 (optimistic-at-top/persist/clear+refocus), R3/R4 risk mapping, data-testid list.
- [Source: _bmad-output/test-artifacts/framework-design/] — drop-in `create.spec.ts`, `optimistic-rollback.spec.ts`, `todos.contract.spec.ts`, `api/todos_test.go`, `fixtures.ts`, `contract.ts`, README drop-in steps.

## Review Findings

_Code review 2026-07-18 — reviewers: Gopher (Go/api), Pixel (web). 9 raised → 3 decision-needed, 2 patch, 2 deferred, 2 dismissed. All decision-needed + patch resolved (applied) 2026-07-19; web verified green (Vitest 11/11, eslint/prettier clean), Go verified compile/vet clean (`-tags testseed`)._

**Decision-needed (resolved → patched):**

- [x] [Review][Decision→Patch] Concurrent in-flight adds could transiently clobber a sibling row — **RESOLVED: hardened now.** `useCreateTodo` `onError` now removes only this add's row by temp id (was a whole-list snapshot restore), and `onSettled` gates the reconcile on `isMutating({ mutationKey: createTodoMutationKey }) === 1` so an early refetch can't drop a still-pending sibling. Added a deterministic concurrency regression test. [web/lib/useCreateTodo.ts, web/tests/add-input.test.tsx]
- [x] [Review][Decision→Patch] New error microcopy vs. "No other new strings this story" — **RESOLVED: trimmed** to the test-design-sanctioned phrase `"Something got in the way. Try again."` (dropped the added "Your tasks are safe…" sentence). [web/app/components/AddInput.tsx]
- [x] [Review][Decision→Patch] AC9 Go "injection inert" test absent — **RESOLVED: added** a `testseed`-guarded repository↔Postgres integration test (`TestCreateTodo_SQLInjectionPayloadIsInert`) that posts `'; DROP TABLE todos; --` through the real parameterized INSERT and asserts stored-literal + table intact. Runs under `go test -tags testseed` against the test-compose DB (skips cleanly without `DATABASE_URL`); Playwright `1.2-INT-003` still covers it end-to-end. [api/repository/repository_injection_test.go]

**Patch (resolved):**

- [x] [Review][Patch] Missing astral / boundary rune-count unit test — **DONE.** Added: a 200-code-point astral title (400 UTF-16 units) is accepted (fails on a `.length` regression), and a 196-ASCII + 5-code-point ZWJ-family title (201 code points) is blocked (fails on grapheme-counting). [web/tests/add-input.test.tsx]
- [x] [Review][Patch] Stale error alert lingers over unrelated typing — **DONE.** `onChange` now calls `create.reset()` when `create.isError`, so a prior rejection's banner clears the moment the user edits. [web/app/components/AddInput.tsx]

**Deferred:**

- [x] [Review][Defer] Over-cap `aria-invalid` exposes no reason to assistive tech [web/app/components/AddInput.tsx:70] — deferred, out of scope (full SR/`aria-live` coverage is UX-DR28 / Story 3.3; visible counter also 3.3).
- [x] [Review][Defer] `outline: 'none'` + always-painted focus halo [web/app/components/AddInput.tsx:98,103] — deferred; benign in 1.2 (input is always focused), revisit when Story 1.3 adds other focusable rows so keyboard `:focus-visible` is preserved.

**Dismissed (noise / handled elsewhere):** validation message says "characters" not "code points" (correct user-facing language; Epic 3 owns copy); `contract_test.go` pins the serializer not the endpoint (fully mitigated — `TestCreateTodo_ValidReturns201AD6Shape` + `TestListTodos_WireShape` assert the wire shape against the live handler).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context) — BMAD dev-story workflow.

### Debug Log References

- **Go runs in a container** (Go not on host, per 1.1): `docker run --rm -v "$PWD/api":/app -w /app golang:1.26-alpine …` for build/vet/test/gofmt (both `!testseed` and `-tags testseed`); `golangci/golangci-lint:v2.12.2` for the lint gate.
- **staticcheck ST1018** flagged the ZWJ family-emoji string literal (invisible U+200D format char) in `service_test.go`. Rebuilt the grapheme from explicit rune code points — `string([]rune{0x1F468, 0x200D, 0x1F469, 0x200D, 0x1F467})` — so the source carries no invisible format characters. golangci-lint → 0 issues.
- **Proxy 204 bug surfaced + fixed** (`web/app/api/[...path]/route.ts`): the proxy always passed the (non-null) upstream body to `new Response(body, { status })`, which **throws for 204/304** (null-body statuses) and was mis-reported as a 502. The new test-reset route returns 204, so this blocked test cleanup; it would also have bitten Epic 2's commit-`DELETE` (204). Fixed by forwarding `null` as the body for 204/304/1xx — restores the AD-3 "forward verbatim" contract. Verified: `POST /api/internal/test/reset` → 204 through the proxy.
- **Test-cleanup gap resolved (Task 8 decision):** `DELETE` is Epic 2, so per-id cleanup isn't available. Added a `//go:build testseed`-guarded, **prod-unreachable** reset route `POST /internal/test/reset` (`api/testroutes_testseed.go`, delegates to `testhelpers.ResetTodos`), a Dockerfile `GO_BUILD_TAGS` arg, and a `docker-compose.test.yml` override that builds `api` with `-tags testseed`. Web fixtures reset via that endpoint (truncate), so the Playwright suite runs serially (`workers: 1`) until DELETE-based per-id cleanup lands in 2.3. The production image never sets the tag → the seam stays out of prod (TC1).
- **Deviation from the drop-in `api/todos_test.go` sketch:** that sample assumed a bespoke `newTestClient` HTTP helper. The same api-boundary P0s (create→201 AD-6, empty→400, injection inert) are covered instead by the **Playwright integration project** (`1.2-INT-001/002/003`) against the live stack, plus Go handler/service **unit** tests — so R3/R4 are green without hand-rolling a second Go HTTP client.

### Completion Notes List

Story 1.2 implemented and verified end-to-end. All 9 ACs satisfied.

**Backend (api):** `Repository.CreateTodo` (parameterized `INSERT … RETURNING`, AD-7 server-assigned fields), `Service.CreateTodo` (trim-then-rune-cap validation, AD-10; typed `model.ValidationError` so the handler maps 400 without importing the service package), `POST /todos` handler (binds `{title, description}` only → ignores client `id/status/metadata`; reuses `wire.go` serializer for the 201 body).

**Frontend (web):** `createTodo` + `useCreateTodo` (TanStack v5 optimistic mutation: `cancelQueries`→snapshot→prepend temp row→`onError` restore→`onSuccess` swap temp id for the server UUID→`onSettled` reconcile — shaped for Epic 2/3 reuse); `AddInput` (pinned, focused-on-load + refocus-after-add, Enter/Add parity, code-point cap mirror, RD-3 over-cap block, ref-based double-add guard robust to stale-closure double-Enter); wired into `page.tsx` above the list at every state, with a non-disruptive add-error alert.

**Verification evidence:**
- **AC1** — Browser (live stack): typed a title + Enter → row popped to top, input cleared + kept focus. Playwright `1.4-E2E-001` green (desktop + mobile).
- **AC2** — Browser: after reload the row persisted carrying a real UUID v4 (temp id swapped), `status=active`, nested `metadata`. Live curl: `POST` → `201` + exact AD-6 wire shape. Go `TestCreateTodo_ValidReturns201AD6Shape`.
- **AC3** — Playwright `1.4-E2E-002` (whitespace → no row, **no POST sent**, focus retained) + Vitest whitespace test.
- **AC4** — Live curl + Go/service unit tests: empty→400 `validation_error`; 200 code points→201, 201→400 (inclusive boundary); code-point (rune) counting incl. a 5-code-point ZWJ grapheme; client `id/status/metadata` ignored (server assigns). Vitest RD-3 over-cap block.
- **AC5** — Vitest double-add guard (two Enters, no keystroke between → one POST).
- **AC6** — Vitest rollback+error test (real hook + list): optimistic row removed on 500, error alert shown, list reconciles to empty server truth. Playwright `3.2-E2E-001` (desktop + mobile) confirms visible rollback + error end-to-end.
- **AC7** — Go `TestWireContract_MatchesSharedTodoShape` pins the JSON key set/nesting (drift → red build); Playwright `assertTodoShape` on a live `POST`→`GET`. `shared/README.md` updated (enforcement landed).
- **AC8** — Go injection payload handled via parameterized SQL; Playwright `1.2-INT-003` (payload stored verbatim, table intact); browser shows the payload as harmless literal text.
- **AC9** — Green: Vitest **8**; Go **13** (handler/service/contract) + gofmt + vet + golangci-lint **0 issues** + both build tags compile; Playwright **P0 15** (e2e desktop + e2e-mobile + integration) incl. the injection test. Web gate `eslint`/`prettier` clean; `next build` (TS) clean. Cold `docker compose up` healthy in order (db→api→web); only `web` host-exposed.

**Deviations / notes:** (1) `ValidationError` placed in `model` (not `service`) to keep the handler decoupled from the concrete service package (handler still owns its `TodoService` interface). (2) The minimal title-only list (Story 1.1 safety net) does not yet wrap long rows — horizontal-overflow polish is **Story 1.3** (full row anatomy), out of 1.2 scope. (3) Proxy 204 fix (see Debug Log) is a small in-scope correctness fix required by the 204-returning reset route.

### File List

**New — api/**
- `api/handler/contract_test.go` — AD-6 contract-drift guard (AC7)
- `api/service/service_test.go` — validation unit tests (trim, rune caps, boundaries, code-points)
- `api/testroutes.go` — no-op `registerTestRoutes` (prod build)
- `api/testroutes_testseed.go` — `POST /internal/test/reset` (testseed build only, TC1)

**New — web/**
- `web/lib/useCreateTodo.ts` — optimistic create mutation hook
- `web/app/components/AddInput.tsx` — pinned add-input
- `web/tests/add-input.test.tsx` — web-unit (client rules, double-add, rollback+error)
- `web/playwright.config.ts` — E2E/integration config (serial, test-compose webServer)
- `web/tests/support/contract.ts`, `web/tests/support/fixtures.ts` — AD-6 assertions + seed/reset (reset endpoint)
- `web/tests/e2e/create.spec.ts`, `web/tests/e2e/optimistic-rollback.spec.ts` — E2E (create loop, add rollback)
- `web/tests/integration/todos.contract.spec.ts` — api-boundary contract + injection

**New — root**
- `docker-compose.test.yml` — test override (builds `api` with `-tags testseed`)

**Modified — api/**
- `api/model/todo.go` — `ValidationError` type
- `api/repository/repository.go` — `CreateTodo` (interface + Postgres)
- `api/service/service.go` — `CreateTodo` + validation caps
- `api/handler/handler.go` — `POST /todos` route, `createTodo`, `createTodoRequest`, interface method
- `api/handler/handler_test.go` — stub `CreateTodo` + POST handler tests
- `api/main.go` — `registerTestRoutes(router, pool)` call
- `api/Dockerfile` — `GO_BUILD_TAGS` build arg

**Modified — web/**
- `web/lib/todos.ts` — `createTodo` + `CreateTodoRequest` import
- `web/app/page.tsx` — render `<AddInput />` above the list
- `web/app/api/[...path]/route.ts` — 204/304 null-body proxy fix
- `web/package.json` — `test:e2e` scripts + `@playwright/test`/`@faker-js/faker` devDeps
- `web/package-lock.json` — lockfile
- `web/.prettierignore` — ignore Playwright artifacts

**Modified — root / shared**
- `shared/README.md` — contract enforcement note (landed in 1.2)
- `.gitignore` — ignore Playwright `test-results/` + `playwright-report/`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status transitions
- `_bmad-output/implementation-artifacts/1-2-create-a-todo-optimistic-end-to-end.md` — this story file

## Change Log

| Date | Change |
| --- | --- |
| 2026-07-18 | Story 1.2 implemented: `POST /todos` (repository→service→handler) with server-authoritative trim+rune validation (AD-10) and AD-6 201 body; web optimistic add (`useCreateTodo` + `AddInput`) with temp-id swap (AD-7), visible add-path rollback (AC6), double-add guard (AC5), and code-point cap mirror (RD-3). Turned on the R3 contract-drift guard (Go `contract_test.go` + Playwright `assertTodoShape`) and R4 injection test. Resolved the test-cleanup gap with a `testseed`-guarded reset route + `docker-compose.test.yml`. Fixed a latent proxy bug (204/304 null-body → bogus 502). All gates green: Vitest 8, Go 13 + golangci-lint 0, Playwright P0 15 (desktop+mobile+integration); live `docker compose up` + browser verified. Status → review. |
