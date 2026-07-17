# todo-app — Test Framework Design (drop-in)

**Status:** design-only. Nothing installed. Copy these files into the real repo once Epic 1 Story 1.1 scaffolds `web/`, `api/`, and `shared/`.

**Why design-only:** the project is greenfield — Playwright/Vitest install into `web/package.json` and Go test lives in `api/`, neither of which exists yet. This package is the ready-to-drop shape so framework setup is a copy-and-install, not a from-scratch decision, later.

---

## Selected frameworks (fullstack)

| Layer | Tool | Scope |
|---|---|---|
| `web` E2E + api-integration through the proxy | **Playwright** (`@playwright/test`) | user journeys, optimistic UX, rollback, contract |
| `web` unit | **Vitest + React Testing Library** | mutation logic, rollback reducers, formatters, rune-count |
| `api` unit + integration | **Go test + testify** | validation, status transitions, contract, injection, repository↔Postgres |
| perf (later) | **k6** | NFR1 p95 smoke — deferred until U1 load definition |

> `@seontechnologies/playwright-utils` is optional (`tea_use_playwright_utils=true`). Samples here use vanilla `@playwright/test` so they run without a proprietary dependency. Swap the fixture import if the team adopts utils.

## Where files land (mirrors ARCHITECTURE-SPINE source tree)

```text
todo-app/
  web/
    playwright.config.ts        <- framework-design/web/playwright.config.ts
    vitest.config.ts            <- framework-design/web/vitest.config.ts
    tests/
      support/
        fixtures.ts             <- todo factory, seed/reset [TC1], fake clock [R9]
        contract.ts             <- AD-6 wire-contract assertions [R3]
      e2e/
        create.spec.ts          <- 1.4-E2E-001 core loop (P0)
        optimistic-rollback.spec.ts  <- 3.2 rollback, the score-9 [R1] (P0)
      integration/
        todos.contract.spec.ts  <- 1.2/1.3 contract at the api boundary (P0)
  api/
    todos_test.go               <- validation + injection + contract [R4/R3] (P0)
    testhelpers/
      seed.go                   <- test-only seed/reset seam [TC1]
  shared/                       <- (from Story 1.2) single source-of-truth wire type [R3/AD-6]
```

## Risk-review wiring (what each enabler closes)

- **TC1 — seed/reset seam:** `fixtures.ts` `seedTodos()/resetTodos()` (web) + `api/testhelpers/seed.go` (Go). Test profile only, never prod-reachable.
- **TC5 — `/health` readiness:** Playwright `webServer` waits on `/health`; `todos_test.go` asserts it. CI E2E gates on it.
- **R9 — timer determinism:** `installClock()` in `fixtures.ts`; the ~5s undo window and relative-time tests use it. **`waitForTimeout` is banned** (see `test-quality`).
- **R3 — contract drift:** `contract.ts` asserts every AD-6 invariant (`[]`≠null, `""`≠null, camelCase, `metadata` nesting, partial PATCH, 201/200/204, 404-as-success) from the `shared/` type.
- **R1 — optimistic rollback (score 9):** `optimistic-rollback.spec.ts` forces server rejection on each mutation and asserts visible rollback + post-rollback refetch equals server (CM2).

## Drop-in steps (after Story 1.1)

1. Copy `web/*` into the real `web/`; copy `api/*` into the real `api/`.
2. `cd web && npm i -D @playwright/test vitest @testing-library/react @faker-js/faker && npx playwright install`.
3. Ensure `api` exposes `GET /health` [TC5] and a test-only seed/reset path [TC1].
4. Merge `web/package.scripts.md` into `web/package.json`.
5. Run: `cd web && npm run test:unit && npm run test:e2e`; `cd api && go test ./...`.
6. Then `/bmad-testarch-atdd` for red-phase P0 acceptance tests.

## Quality bar (enforced in samples, per `test-quality`)

No hard waits (network-first + fake clock) · self-cleaning (`resetTodos` per test) · explicit assertions in test bodies · unique data via faker · parallel-safe. Test IDs follow `{EPIC}.{STORY}-{LEVEL}-{SEQ}` from the QA doc.

## Knowledge base references

`fixture-architecture.md` · `playwright-config.md` · `network-first.md` · `data-factories.md` · `test-quality.md` · `test-levels-framework.md`
