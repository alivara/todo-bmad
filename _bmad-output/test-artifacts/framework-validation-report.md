# Test Framework — Validation Report

**Target:** `_bmad-output/test-artifacts/framework-design/` (design-only, greenfield)
**Validated against:** `bmad-testarch-framework/checklist.md`
**Mode:** V (validate) · **By:** Master Test Architect · **Date:** 2026-07-17

## Verdict

**PASS with warnings.** The framework design is sound, risk-wired, and drop-in ready. It selects appropriate tools, closes every risk-review enabler with a concrete artifact, and honors the quality bar (no hard waits, self-cleaning, no secrets, parameterized SQL). The warnings are (a) items that cannot be *executed*-validated until Story 1.1 scaffolds real code — inherent to a design-only run — and (b) a small number of checklist deviations, most of them deliberate and defensible, plus one genuine artifact gap.

## Section results

| Checklist area | Result | Notes |
|---|---|---|
| Prerequisites | ⚠️ WARN | No project manifest exists (greenfield). This is the declared design-only condition, not a defect — the design installs *into* `web/`/`api/` once Story 1.1 creates them. |
| Step 1 — Preflight | ✅ PASS | Stack correctly detected fullstack; project type from ARCHITECTURE-SPINE; conflicts none; architecture docs located. |
| Step 2 — Framework selection | ✅ PASS | Playwright (E2E+api-integration), Vitest+RTL (web unit), Go test+testify (api). Justified per layer; `playwright-utils` correctly treated as optional (`tea_use_playwright_utils=true`) with vanilla samples. |
| Step 3 — Directory structure | ✅ PASS (note) | `support/` present (the key pattern) with `fixtures.ts` + `contract.ts`; `e2e/` + `integration/` split. No `fixtures/factories/`, `helpers/`, `page-objects/` subdirs — permitted by the checklist's flexibility note; the factory (`makeTodo`) is folded into `fixtures.ts`, fine for this surface. |
| Step 4 — Configuration | ⚠️ WARN | `playwright.config.ts` present, valid, base-URL env fallback, parallel, CI retries/workers, `webServer` health-gate [TC5]. **Deviations:** explicit action/nav/test timeouts not set (deliberate — "no timeout crutch", network-first); `trace: on-first-retry` (checklist suggests `retain-on-failure-and-retries`); no `video`; **no JUnit reporter** (CI uses `github`+`html`). See recommendations. |
| Step 5 — Environment config | ⚠️ WARN | No `.env.example`/`.nvmrc`/`TEST_ENV` produced here — deferred to Story 1.1 (AD-12 owns the env envelope). Acceptable by design; flagged so it isn't dropped. |
| Step 6 — Fixture architecture | ✅ PASS | `base.extend` fixture, seed/reset [TC1] with auto-cleanup teardown, fake clock [R9]. Matches `fixture-architecture.md`. Minor: `any[]` types pending the `shared/` wire type (Story 1.2). |
| Step 7 — Data factories | ✅ PASS (note) | `makeTodo` + faker for unique data; cleanup via `resetTodos`. Lightweight (function not class) — appropriate for one entity. |
| Step 8 — Sample tests | ⚠️ WARN | `optimistic-rollback.spec.ts` (flagship R1/CM2, GWT, network-first, seeded) and `todos.contract.spec.ts` present and high quality. **Gap: `create.spec.ts` is referenced in the README tree but is NOT on disk** — the named core-loop create E2E sample is missing. |
| Step 9 — Helpers | ✅ PASS | `contract.ts` (reusable AD-6 assertions) + `api/testhelpers/seed.go` (build-tag guarded, parameterized SQL). |
| Step 10 — Documentation | ✅ PASS | `README.md` covers selection, file map, risk wiring, drop-in steps, quality bar, KB refs. Minor: `vitest.setup.ts` exists on disk but isn't listed in the README file tree (doc drift). |
| Step 11 — Scripts | ✅ PASS | `package.scripts.md` defines unit/e2e/p0/contract scripts + dev-deps; Go invocation documented incl. `-tags testseed`. |
| Output / Execution validation | ⏸️ N/A until install | Config-loads, sample-executes, artifacts-generated, `npm install`/`go test` cannot be verified with no code on disk. To be re-validated at Story 1.1 drop-in (drop-in step 5). |
| Best-practices compliance | ✅ PASS (note) | No hard waits (network-first + fake clock; `waitForTimeout` explicitly banned and unused), self-cleaning, unique faker data, parallel-safe, GWT, explicit assertions. **Selector deviation:** specs use role/label/placeholder locators, not `data-testid` — a defensible *modern* Playwright practice that also exercises the semantic controls UX-DR27 requires. |
| Security | ✅ PASS | No credentials/secrets/API keys in any file; config reads `BASE_URL` from env; seed uses parameterized SQL. |
| KB alignment | ✅ PASS | Cites `fixture-architecture`, `playwright-config`, `network-first`, `data-factories`, `test-quality`, `test-levels-framework`; patterns applied. |
| Integration points | ✅ PASS | Logged in `framework-setup-progress.md`; `test-design` already proceeded downstream; compatible with `ci`/`atdd`. |
| Pact CDC section | ⏸️ N/A | `tea_use_pactjs_utils=false` — not applicable. |

## Findings to act on

1. **[Gap] `create.spec.ts` missing.** The README file tree lists `web/tests/e2e/create.spec.ts` ("1.4-E2E-001 core loop, P0"), but the file is not on disk. Either author it at drop-in (it's the core happy-path E2E) or remove the reference from the README so the tree matches reality.
2. **[Minor] Add a JUnit/blob reporter** to `playwright.config.ts` for CI result ingestion (the `ci` workflow will want it); consider `trace: 'retain-on-failure'` and enabling `video: 'retain-on-failure'` to match the checklist's artifact-on-failure intent.
3. **[Minor] README doc drift:** add `vitest.setup.ts` to the file tree.
4. **[Carry-forward] Env envelope** (`.env.example`, `.nvmrc`, `TEST_ENV`) is owned by Story 1.1 (AD-12) — ensure it lands there; the framework assumes `BASE_URL`.
5. **[Re-validate at install]** Re-run this validation's Execution section after Story 1.1 drop-in: `cd web && npm run test:unit && npm run test:e2e` and `cd api && go test ./...`.

## Deliberate deviations (accepted, not defects)

- No fixed action/nav/test timeouts — network-first + fake clock instead (stronger than fixed waits).
- Role/label locators over `data-testid` — current Playwright guidance; doubles as a semantic-controls check (UX-DR27).
- Flat `support/` layout — the checklist explicitly allows organizational flexibility; `support/` is present.

**Sign-off:** Design-only framework is validated as **ready to drop in** at Epic 1 Story 1.1, subject to re-running the execution checks once code exists.

## Post-validation fixes applied (2026-07-17)

Findings #1–#3 were fixed in place (Edit-mode follow-up):

- **#1 resolved** — authored `web/tests/e2e/create.spec.ts`: the core capture loop (1.4-E2E-001…004 + 1.4-INT-001) — optimistic top-insert + focus retention, whitespace-title rejection with no request sent, newest-first ordering, reload persistence, and a GET-contract-shape check reusing `assertTodoShape`. Network-first, fixture-seeded, `@e2e @p0`. The README tree now matches disk.
- **#2 resolved** — `playwright.config.ts`: added a **JUnit reporter** (`test-results/junit.xml`) to the CI reporter set, switched `trace` to `retain-on-failure`, and added `video: 'retain-on-failure'`.
- **#3 resolved** — README file tree now lists `vitest.setup.ts`.

**Remaining (unchanged, by design):** #4 env envelope (`.env.example`/`.nvmrc`/`TEST_ENV`) is owned by Story 1.1 (AD-12); #5 execution-level checks re-run at drop-in. Deviations (no fixed timeouts, role/label locators, flat `support/`) remain accepted.

**Updated verdict:** PASS — no open artifact gaps; only install-time re-validation pending.
