---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04-assess-and-gate']
lastStep: 'step-04-assess-and-gate'
lastSaved: '2026-07-19'
workflowType: 'testarch-nfr'
nfrFocus: 'security'
securityScope: ['xss', 'injection']
evidenceMethod: 'Static code review of the injection + XSS surfaces on merged main + live injection-inertness test'
baselineRevision: '7f883b2'
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md (NFR9, NFR10)'
  - '_bmad-output/project-context.md (AD-9, AD-10, server-authoritative validation)'
  - 'api/repository/repository.go, api/service/service.go, api/handler/handler.go'
  - 'web/app/components/TodoRow.tsx, web/app/page.tsx, web/app/api/[...path]/route.ts'
  - 'shared/todo.ts, api/migrations/000001_create_todos.up.sql'
---

# Security Review — XSS & Injection

**Evaluator:** Alivara (Murat, Master Test Architect)
**Date:** 2026-07-19
**Scope:** Cross-site scripting (XSS) and injection (SQL + related) only, per request. AuthN/AuthZ, secrets, and dependency CVEs are out of scope (the app is single-user, no auth in v1 — AD-2/NFR8).
**Method:** Static review of every user-input → sink path on `main` @ `7f883b2`, plus the existing live injection-inertness test.
**Threat model:** self-hosted, single-user; only `web` is host-exposed; `api` + `db` are internal-only (AD-12). Primary threat is a malicious payload in a todo `title`/`description` (stored) or a crafted request to the proxy.

## Verdict: ✅ PASS (no exploitable XSS or injection found)

Both classes are defended at the correct layer with defense-in-depth. Three **LOW/INFO** hardening items are tracked below; none is a release blocker for this threat model.

---

## Injection — SQL & related

**Status: ✅ PASS (strong).**

| Surface | Finding |
| --- | --- |
| `ListTodos` / `CreateTodo` | Static SQL; values bound as `$1`/`$2` via pgx. No interpolation. |
| `UpdateTodo` (dynamic partial UPDATE) | The one place SQL is assembled at runtime. **Column names are a static whitelist** (`title`/`description`/`status` string literals), and only **placeholder numbers** (`$%d`) are `fmt.Sprintf`'d in — **never a user value**. Every value goes through `args ...any` as a bound parameter. `id` is the final bound parameter. ✅ |
| Empty-patch path | Parameterized `SELECT … WHERE id = $1`. ✅ |
| `id` handling | Malformed (non-uuid) id → Postgres `22P02` is caught and mapped to `NotFoundError` (404), not surfaced — no error-based info leak. ✅ |
| Test-seed seam (`testhelpers/seed.go`) | Parameterized `INSERT`; `testseed` build-tag guarded — never in the prod image. ✅ |
| Evidence | `repository_injection_test.go`: sends `'; DROP TABLE todos; --` through the real INSERT and asserts it is stored **verbatim** and the table survives. ✅ |
| Schema defense-in-depth | `status text … CHECK (status IN ('active','completed'))` (AD-8) backs the service allow-list; `title`/`description` are `text NOT NULL`. ✅ |

**No SQL/NoSQL/command/ORM injection surface exists.** SQL lives only in `repository/` (AD-1); the service and handler never touch it.

## XSS — stored & reflected

**Status: ✅ PASS (strong).**

| Surface | Finding |
| --- | --- |
| Rendering `title` / `description` | Rendered as **React text children** (`{todo.title}`, `{todo.description}`) → auto HTML-escaped. A `<script>`/`<img onerror>` payload renders as inert text. ✅ |
| Multiline description | Uses CSS `whiteSpace: 'pre-wrap'` for newlines — **not** `innerHTML`. ✅ |
| Dangerous sinks | **Zero** occurrences of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function` in `web/app` or `web/lib`. ✅ |
| Attribute contexts | `aria-label={…todo.title…}`, `<time dateTime={createdAt}>` — React escapes attribute values; no `href`/`src`/`style` string built from user input. ✅ |
| Server storage | Server stores **raw** trimmed text (does not HTML-encode at rest) — this is **correct**: encoding is the render layer's job (React), and storing raw preserves fidelity. Server sanitization is authoritative for *validation* (trim + rune caps), per NFR10/AD-10. ✅ |
| Reflected error messages | AD-9 error messages are **static templates** (`"title is required"`, `"title must be at most 200 characters"`) — user input is never echoed back into a response. ✅ |
| Error leakage | `gin.Recovery()` + structured server-side `slog`; no stack trace or DB error reaches the client. ✅ |

---

## Findings & Remediations

### SEC-1 — No Content-Security-Policy / security response headers · Severity: LOW (hardening)
**Finding:** `web/next.config.mjs` sets no response headers and there is no `middleware.ts`. React's output-escaping is the sole XSS control. Adding a CSP + standard headers is defense-in-depth: it would blunt any *future* regression (a `dangerouslySetInnerHTML`, a compromised dependency, an injected inline script) and stop clickjacking/MIME-sniffing.
**Failure scenario it prevents:** a future contributor adds `dangerouslySetInnerHTML` (or a dep introduces a sink) → today that would execute; a strict CSP (`script-src 'self'`) would block inline/injected script execution.
**Remediation** (`web/next.config.mjs`):
```js
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
];
const nextConfig = {
  output: 'standalone',
  async headers() { return [{ source: '/:path*', headers: securityHeaders }]; },
};
```
> Note: Next's inline runtime may need `style-src 'unsafe-inline'` (kept above) — validate against the app; tighten with a nonce later if desired. Add an E2E/CI assertion that the CSP header is present.

### SEC-2 — Proxy forwards all non-hop-by-hop request headers verbatim · Severity: INFO
**Finding:** `route.ts` strips hop-by-hop/host headers (good) but forwards every other client header to the internal `api`. For a dumb proxy on an internal-only network this is acceptable and intentional (AD-3), but there is no positive allowlist.
**Remediation (optional):** if the api ever trusts a header (e.g. `X-Forwarded-*`, auth), switch to an allowlist. No action needed for v1.

### SEC-3 — Stored text is not HTML-encoded at rest (by design) · Severity: INFO (forward-guard)
**Finding:** titles/descriptions are stored raw; safety depends entirely on the *render* layer encoding. Correct today (React). **Forward-guard:** any *future* non-React rendering of todo text — HTML email, CSV/PDF export, server-rendered HTML fragment — MUST apply context-appropriate encoding, or stored XSS becomes reachable there.
**Remediation:** none now; add an encoding step at the point any such feature is introduced (and note it in that story's spec).

### SEC-4 — SSRF surface at the proxy · Severity: INFO (reviewed-safe)
**Finding:** the proxy builds `${API_INTERNAL_URL}/${path.join('/')}${search}` with a **fixed** upstream host from env. A client cannot redirect the request to an arbitrary host; path segments (incl. `..`) stay within the api host after normalization. No open SSRF.
**Remediation:** none. Keep `API_INTERNAL_URL` non-overridable by request input (it is).

---

## Corroborating tests (existing)
- `api/repository/repository_injection_test.go` — SQL-injection payload stored inert (live Postgres, `testseed`).
- `api/handler/contract_test.go` + `web/tests/integration/todos.contract.spec.ts` — wire-contract shape (bounds the accepted input surface).
- Server validation: `api/service/service_test.go` (trim + rune caps + status allow-list, never reaches repo on invalid).

## Recommendations (priority order)
1. **SEC-1 — add the CSP + security headers** and a CI/E2E assertion that they are served. Cheapest meaningful hardening; do it this milestone (fits Epic 3 "polish + a11y/security floor").
2. Add a small **stored-XSS render test** (RTL): a todo whose title is `<img src=x onerror=alert(1)>` renders as escaped text (locks the React-escaping guarantee against future refactors).
3. Keep SEC-3 as a spec checklist item for any future export/email/SSR-HTML feature.

**Overall XSS/Injection posture: LOW risk. Gate: PASS.** No blocking or CONCERNS-level issues; SEC-1 is a recommended LOW hardening item, not a release blocker for the single-user self-hosted threat model.

**Generated:** 2026-07-19 · **Workflow:** testarch-nfr (security focus — XSS & injection)
