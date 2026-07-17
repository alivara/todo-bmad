# Rubric Review — ARCHITECTURE-SPINE.md (todo-app)

**Reviewer:** rubric walker
**Date:** 2026-07-17
**Spine:** `_bmad-output/planning-artifacts/architecture/architecture-todo-app-2026-07-17/ARCHITECTURE-SPINE.md`
**Driving spec:** `_bmad-output/planning-artifacts/prds/prd-todo-app-2026-07-17/prd.md` (+ `addendum.md`)

**Overall verdict: NEEDS-WORK** — structurally strong, crisp, and right-sized, but it fixes the core entity/wire contract on the *wrong* shape: it collapses the PRD's two fields (`title` + `description`) into a single `description` and explicitly declares "no `title`". Every story built from AD-6/AD-10, the ER diagram, and the endpoint table inherits that error and will diverge from the product the PRD describes. One concentrated root cause, but it's load-bearing and touches 7 FRs. A second, smaller mechanism gap sits in AD-5.

---

## 1. Fixes the real divergence points for the level below; misses none — **FAIL**

The set of boundaries a spine must pin is otherwise well chosen and complete: dependency direction (AD-1), the multi-user seam (AD-2), proxy-vs-logic ownership (AD-3), server-state ownership + optimistic/rollback (AD-4), pending-delete lifecycle (AD-5), wire contract (AD-6), id/timestamp authority (AD-7), status modeling (AD-8), error contract (AD-9), validation authority (AD-10), migrations (AD-11), deployment envelope (AD-12), plus endpoints/ordering conventions. That is genuinely the right list of divergence points for independently-built `web`/`api`/`db`.

But the single most-inherited divergence point — the entity shape — is fixed **wrong**. The PRD is unambiguous that a todo has a required `title` **and** an optional `description` (UJ1, FR1, FR6, FR9, FR11, FR19, FR24; glossary defines both as distinct). AD-6 fixes the wire resource as a **single `description` field** and writes "One text field, `description` — no `title`, no notes." The two-field split is itself a real divergence point (client and API must agree there are two fields, which is required, which is capped at what) and it is not merely missed — it is actively contradicted. Stories will lock in a one-field model that cannot satisfy the PRD.

## 2. Every AD's Rule is enforceable and prevents its stated divergence — **CONCERN**

Rules AD-1, AD-2, AD-3, AD-4, AD-6..AD-12 are concrete, testable, and each names the divergence it kills — no vagueness. The concern is **AD-5**: its rule asserts the *outcome* "Reload/close mid-window = committed … the todo does not reappear," but its own mechanism forbids the means. It mandates a purely client-side timer with **no network call during the window** and undo with **no round-trip**. If the tab closes before the ~5s timer elapses, the `DELETE` was never sent, the row is still in the DB, and it **will** reappear on reload — the opposite of what the rule (and FR15) require. Satisfying FR15 needs an explicit commit-on-unload hook (e.g. `sendBeacon`/`beforeunload`) or a fire-immediately-and-undo-recreates model; the spine specifies neither and its stated constraints preclude the obvious one. The rule states a guarantee its mechanism can't deliver.

## 3. Nothing load-bearing wrongly deferred — **PASS**

Deferred items (testing conventions, optimistic concurrency, auth/multi-user, API versioning, accessibility) are all genuinely non-load-bearing for a single-user v1. The seams they'd need later (AD-2 repository, AD-3 auth-injection point, AD-8 text-enum) are already prepared, so deferring them cannot let two units diverge today. Last-write-wins is explicitly acceptable at single-user. Correct deferrals.

## 4. Named tech is verified-current — **PASS**

Stack table matches the verified-current set exactly: Next.js 16.2 LTS, TanStack Query 5.x, Go 1.26, Gin 1.12, golang-migrate 4.x, PostgreSQL 18, Docker Compose current. No stale or invented versions.

## 5. Covers the driving spec's capabilities (Features A–G, FRs, NFRs) — **FAIL**

Feature-to-architecture mapping is present and each of A–G is routed to a home and governing ADs; error/loading/empty states (G), ordering (FR8), optimistic rollback (FR23/CM2), durable persistence (FR17/NFR3), single-command startup (NFR11), server-authoritative validation (NFR10), and the extensibility seams (NFR8/FR19) are all covered well.

The data-model coverage fails, cascading from item 1:
- **`title` is entirely absent** — FR1, FR2, FR6, FR9, FR11, FR19 all require it. FR11's "empty title rejected, revert to prior title; description may be cleared" is uncoverable when there is only one field.
- **AD-10 inverts the optionality**: it enforces a **non-empty/non-whitespace** rule on the single `description`, but the PRD's `description` is **optional / may be blank** (FR1, FR3, FR11). The non-empty rule belongs to `title`.
- **AD-10 / AD-6 use a 500-char cap**; FR24 specifies **title ≤200** and **description ≤2000**. The 500 figure appears in neither the PRD nor the addendum — invented and wrong.

## 6. No whole dimension left silent (esp. operational/environmental envelope) — **PASS**

The operational envelope is decided, not silent: AD-12 + the topology diagram pin compose services, the single host-exposed port, internal-only api/db, named-volume durability, healthcheck-gated ordering, migrate-on-boot (AD-11), and 12-factor env/secrets handling with working defaults. Security (parameterized SQL, server-side sanitization, internal network, React output-escaping), logging (structured in `api`, React error boundary), and data lifecycle (migrations) are all addressed. Environments are single-local-only, which is correct for portfolio/demo stakes. *Minor note:* NFR6 names "linter/formatter config committed and passing" as a checkable signal, and no lint/format convention appears in the spine — a thin gap within the engineering-quality dimension, not a silent dimension.

## 7. Right-sized for the stakes — **PASS**

Well-calibrated for a portfolio CRUD app. The three-service split, repository seam, `status` text-enum, and versioned migrations are not over-engineering — each is an extensibility line the PRD explicitly asks for (NFR8, FR19) and each stays "clean today, no speculative parameters." Nothing gold-plated (no premature auth, versioning, or concurrency control). Not under-specified in structure. The sizing defects are content-level (wrong cap number, missing field), which land on items 1/5, not on the sizing of the spine itself.

---

## Summary of defects (fix list)

1. **Restore the two-field model** across AD-6 (wire contract + example JSON), AD-10, the ER diagram, the endpoint/PATCH description, and the capability map: `title` (required, non-empty) **and** `description` (optional, nullable/blank).
2. **Fix the caps** to FR24: `title` ≤200, `description` ≤2000 (drop the invented 500).
3. **Move the non-empty rule** from `description` to `title`; make `description` explicitly optional.
4. **Close the AD-5 mechanism gap**: specify how "closed/reloaded mid-window = committed, does not reappear" is actually achieved (e.g. commit-on-unload beacon), since the current no-network-during-window rule cannot deliver FR15.
5. *(Minor)* Add a lint/formatter convention to satisfy NFR6's checkable signal.
