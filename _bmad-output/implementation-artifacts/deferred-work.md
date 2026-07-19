# Deferred Work

## Deferred from: code review of story-1.1 (2026-07-18)

- **Proxy redirect handling** — `web/app/api/[...path]/route.ts`: `redirect:'manual'` yields an opaqueredirect (status 0) that throws in the `Response` constructor and is mis-reported as 502; the `Location` header is also dropped. Latent — the `api` never issues 3xx responses. Revisit if any upstream redirect becomes possible.
- **`fetchTodos` response robustness** — `web/lib/todos.ts`: calls `res.json()` unconditionally, so a 2xx `204`/empty body throws (→ error state) and a non-array/`null` 2xx body crashes the render. Latent — `GET /todos` always returns a JSON array in this system. Add an empty-body + `Array.isArray` guard when the client consumes more endpoints.
- **Boot/serve timeouts** — `api/main.go` + `api/db/db.go`: `context.Background()` (no deadline) is used for Migrate/Connect/Ping, and `router.Run` sets no `http.Server` read/write timeouts. Boot could hang on a half-open DB. Low priority — the service is internal-only.
- **Proxy `HEAD`/`OPTIONS` methods** — `web/app/api/[...path]/route.ts`: only GET/POST/PATCH/PUT/DELETE are exported, so `HEAD`/`OPTIONS` get Next's default 405 instead of reaching the api. Not needed for Story 1.1.

## Deferred from: code review of story-1.2 (2026-07-18)

- **Over-cap `aria-invalid` has no reason exposed** — `web/app/components/AddInput.tsx:70`: over-cap flips `aria-invalid` true and submit silently no-ops, but there is no `aria-describedby`/message, so a screen-reader user gets "invalid" with no reason. Out of scope by spec — full SR/`aria-live` coverage is UX-DR28 and the visible counter is Story 3.3. Add a visually-hidden helper when 3.3 lands.
- **`outline:'none'` + permanently-painted focus halo** — `web/app/components/AddInput.tsx:98,103`: the accent-soft ring is unconditional inline `boxShadow` and `outline` is suppressed. Benign in 1.2 (the field is focused-on-load and refocused after every add), but a blurred input still reads as focused and keyboard `:focus-visible` is gone. Revisit when Story 1.3 introduces other focusable rows — move the halo to `:focus`/`:focus-visible`.

## Deferred from: expert review of story-1.3 (2026-07-19, Pixel)

- source_spec: `spec-1-3-view-the-persistent-task-list.md`
  summary: Body-copy contrast is below WCAG AA — `--ink-secondary` (#8a8072) on `--surface-raised` (#fffcf7) ≈ 3.8:1 for the 14px description and 13px relative time (normal text needs 4.5:1).
  evidence: Pre-existing brand token (defined in `globals.css` since 1.1); Story 1.3 is the first to render body copy in it, so it surfaced here. Fix is a **design decision** (darken `--ink-secondary` toward ~#6f6656 ≈4.6:1, verified with a contrast tool) — not auto-patched to avoid unilaterally changing the brand palette. Needs designer sign-off.
- source_spec: `spec-1-3-view-the-persistent-task-list.md`
  summary: Completed-row text (`--ink-muted` #b8ae9e on #fffcf7 ≈ 1.9:1) is illegible, not merely de-emphasized.
  evidence: Dormant in 1.3 (no `completed` todos exist until Epic 2 activates completion). When Epic 2 lands the toggle, bump completed text to a token clearing ≥4.5:1 (or ≥3:1 if treated as deprioritized content). `web/app/components/TodoRow.tsx` completedTextStyle.

## Deferred from: expert review of story-4.1 (2026-07-19, Gopher + Pixel)

- source_spec: `spec-4-1-ci-fast-lane-quality-gate-unit-tests.md`
  summary: The CI fast lane never compiles or lints the `testseed`-tagged code (`api/testhelpers/seed.go`, `api/testroutes_testseed.go`, `api/repository/repository_injection_test.go`), so a compile/lint break in the reset seam passes green until the Story 4.2 integration lane exists.
  evidence: `go test ./...` runs without `-tags testseed` and golangci-lint sets no build tags — deliberate per this story's "no DB in the fast lane" scope, but a real coverage gap. When 4.2 lands (or sooner), add a cheap `go build -tags testseed ./...` compile guard or set `build-tags: testseed` for the linter. Not this story's problem.
- source_spec: `spec-4-1-ci-fast-lane-quality-gate-unit-tests.md`
  summary: `web/package.json` pins `@types/node` at `^24` while CI/runtime is Node 22 — a latent types-vs-runtime major mismatch.
  evidence: Types-only, so it does not break the current 5 jsdom unit files, but code type-checking green against Node 24 types could reference a Node-24-only API absent at Node-22 runtime. Fix touches `web/package.json` (outside this workflow-only story): align to `@types/node@22` or move CI to Node 24.
- source_spec: `spec-4-1-ci-fast-lane-quality-gate-unit-tests.md`
  summary: No committed Node version pin — CI floats on `node-version: '22'` and there is no `.nvmrc`/`engines`, so CI and local dev can drift within the 22.x line.
  evidence: Go is pinned via `go.mod`; Node has no in-repo source of truth. Fix touches web source/config (outside this workflow-only story): add `web/.nvmrc` (or `engines.node`) and switch the workflow to `node-version-file`.

## Deferred from: security review — XSS & injection (2026-07-19, Murat / TEA)

> Full report: `_bmad-output/test-artifacts/security-review-xss-injection.md`. Review verdict PASS (no exploitable XSS/injection). These are LOW/INFO **hardening** items — the natural home is **Story 3.5 (responsive polish, voice & accessibility floor)**, which already owns the v1 a11y/security floor + NFR9/NFR10.

- source_spec: `security-review-xss-injection.md` (SEC-1)
  summary: No Content-Security-Policy or security response headers — `web/next.config.mjs` sets none and there is no `middleware.ts`; React output-escaping is the SOLE XSS control.
  evidence: LOW/defense-in-depth. A future `dangerouslySetInnerHTML` or a compromised dependency would execute today; a CSP (`script-src 'self'`) plus `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY` would blunt it and stop clickjacking/MIME-sniffing. **Fix (Epic 3 / Story 3.5):** add `async headers()` in `web/next.config.mjs` (ready-to-paste snippet incl. the `style-src 'unsafe-inline'` caveat for Next's inline runtime is in the report) + a CI/E2E assertion that the CSP header is served.
- source_spec: `security-review-xss-injection.md` (SEC-1b)
  summary: No regression test locking the React-escaping guarantee for stored todo text.
  evidence: LOW. Add an RTL test asserting a todo whose title is `<img src=x onerror=alert(1)>` renders as escaped text (not a live element), so a future refactor to a raw-HTML sink fails loudly. Pairs with the CSP work in Story 3.5.
- source_spec: `security-review-xss-injection.md` (SEC-3)
  summary: Stored todo text is raw (not HTML-encoded at rest) — correct today because React encodes at render.
  evidence: INFO/forward-guard. Any FUTURE non-React render of todo text (HTML email, CSV/PDF export, server-rendered HTML fragment) MUST apply context-appropriate output encoding, or stored XSS becomes reachable there. Add an encoding step + note in that feature's spec when introduced.
