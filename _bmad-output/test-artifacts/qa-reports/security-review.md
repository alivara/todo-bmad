# Security Review — todo-app

**Date:** 2026-07-20
**Scope:** Common web vulnerabilities (XSS, injection, dependency vulns, config exposure) across the
request path: browser → Next.js BFF proxy → Gin API → PostgreSQL.
**Verdict:** ✅ **No exploitable findings.** Two low-risk dependency advisories noted (not runtime-reachable / not exploitable in this app).

## Method

- AI-assisted static review of the request path and input handling.
- `npm audit` (web dependencies) and `govulncheck` (Go call-graph analysis).
- Automated evidence: `repository_injection_test.go` (SQL-injection inertness, live Postgres).

## Checklist

| Category | Assessment | Evidence / notes |
| --- | --- | --- |
| SQL injection | ✅ Safe | Parameterized queries (pgx). `TestCreateTodo_SQLInjectionPayloadIsInert` **PASS** — payload stored as literal text through the real INSERT. |
| XSS (stored/reflected) | ✅ Safe | React auto-escapes all rendered todo content. One `dangerouslySetInnerHTML` exists (`app/layout.tsx`) but injects a **static** theme-init constant (`THEME_INIT`) with **no user input** — standard flash-of-theme prevention. |
| Input validation | ✅ Safe | `status` constrained by DB `CHECK (status IN ('active','completed'))`; title/description length limits; `description` never NULL. |
| Mass-assignment | ✅ Safe | `POST` ignores client-supplied `id`/`status`/`metadata` (AD-6). `PATCH` sends only changed fields. |
| Error leakage | ✅ Safe | Unified error contract (Story 3.1) — structured errors to client, no stack traces / internals. |
| Config / secrets exposure | ✅ Safe | Only `web` exposed to host; `api` and `db` internal to the compose network. |
| CORS / origin | ✅ Safe | Same-origin `/api/*` proxy (AD-3); no permissive CORS. |
| Dependency vulnerabilities | 🟡 2 advisories | See below — neither exploitable in this app. |

## Dependency advisories

### 1. `govulncheck` — GO-2026-5676 (quic-go QPACK memory exhaustion)
- **Called-symbol match** via `gin.Engine.Run` → optional HTTP/3 support in `quic-go@v0.59.0`.
- **Runtime reachability: NONE.** The server starts with `router.Run(":port")` (`api/main.go:51`),
  which uses standard **HTTP/1.1** (`net/http` `ListenAndServe`). The HTTP/3 code path is never
  invoked, so the QPACK trailer-expansion vector is not reachable at runtime.
- **Remediation:** bump `github.com/quic-go/quic-go` → **v0.59.1** to clear the scanner (low priority).

### 2. `npm audit` — 2 moderate (postcss `<8.5.10`, XSS via unescaped `</style>`)
- Transitive, pulled in through `next`. This is a **build-time CSS stringify** issue, not a runtime
  path in the served application.
- **Remediation:** `npm audit fix --force` would downgrade `next` (breaking) — **not recommended**.
  Track for the next `next` minor that ships the patched `postcss`. Real risk: low.

## Findings & remediations summary

| # | Finding | Severity | Runtime risk | Remediation | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | quic-go QPACK (GO-2026-5676) | Moderate | None (HTTP/1.1 only) | Bump quic-go → v0.59.1 | Open (low priority) |
| 2 | postcss XSS (transitive via next) | Moderate | None (build-time) | Await patched next minor | Open (low priority) |

## Reproduce
```bash
cd web && npm audit
cd ../api && govulncheck ./...
# injection test (needs Postgres):
DATABASE_URL="postgres://postgres:postgres@localhost:55432/todos?sslmode=disable" \
  go test -tags testseed -run Injection ./repository/
```
