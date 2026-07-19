# Test Coverage Report — todo-app

**Date:** 2026-07-20
**Target:** ≥ 70% meaningful code coverage
**Verdict:** ✅ **PASS** — both stacks exceed 70% on all business-logic packages.

Coverage was measured directly from the test suites (no estimates):
- **Web:** `vitest run --coverage` (v8 provider)
- **API:** `go test -tags testseed -coverprofile` against a live Postgres 18

---

## Web (Next.js client) — `vitest` v8

**18 test files · 115 tests · all passing**

| Metric | Coverage |
| --- | --- |
| **Statements** | **88.75%** (450/507) |
| Branches | 78.64% (232/295) |
| Functions | 86.25% (113/131) |
| Lines | 91.34% (401/439) |

Per-area highlights:

| Area | Stmts | Notes |
| --- | --- | --- |
| `app/api/[...path]` (BFF proxy) | 97.29% | core wire path |
| `lib/` (hooks, optimistic, apiError) | 94.88% | mutation + rollback logic |
| `app/components/` | 87.78% | AddInput, TodoRow, UndoToast |
| `app/` (page/layout/error) | 47.05% | dilution: `layout.tsx`, `providers.tsx`, `error.tsx`, `global-error.tsx` are framework wiring with no branching logic |

**Reproduce:** `cd web && npx vitest run --coverage`

---

## API (Go / Gin) — `go test`

Business-logic packages (statement-weighted, from `go test -cover`):

| Package | Coverage | Role |
| --- | --- | --- |
| `handler` | **93.4%** | HTTP layer (routing, status codes, wire contract) |
| `service` | **94.3%** | business rules / validation |
| `repository` | **81.2%** | persistence (measured against live Postgres) |

**Meaningful coverage (logic layers): all three ≥ 81%.**

Whole-module total including non-logic packages: **64.7%**. This is *diluted* — not a gap — by packages that carry no meaningful branching logic and are exercised end-to-end via integration/E2E instead of unit tests:

- `main.go` — process bootstrap / graceful shutdown
- `db/` — connection-pool + migration bootstrap (run on every real boot)
- `model/` — DTO structs and marshalling
- `testhelpers/` — test-only seed/reset code

**Reproduce (full, needs Postgres):**
```bash
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=todos -p 55432:5432 postgres:18
docker exec -i pg psql -U postgres -d todos < api/migrations/000001_create_todos.up.sql
cd api && DATABASE_URL="postgres://postgres:postgres@localhost:55432/todos?sslmode=disable" \
  go test -tags testseed -coverprofile=cover.out ./...
go tool cover -func=cover.out | tail -1
```
Without a DB, `go test -cover ./...` still runs handler+service (repository tests skip cleanly).

**Evidence files (this folder):**
- `api-coverage.html` — line-by-line HTML report
- `api-coverage-func.txt` — per-function breakdown

---

## Summary vs. success criterion

| Stack | Meaningful coverage | ≥70%? |
| --- | --- | --- |
| Web | 88.75% stmts / 91.34% lines | ✅ |
| API handler | 93.4% | ✅ |
| API service | 94.3% | ✅ |
| API repository | 81.2% | ✅ |
