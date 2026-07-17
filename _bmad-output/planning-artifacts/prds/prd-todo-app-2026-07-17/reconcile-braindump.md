# Reconciliation — Original Brain Dump vs. PRD + Addendum

**Input:** original brain dump (verbal source input)
**Compared against:** `prd.md` + `addendum.md`
**Date:** 2026-07-17

## Method

Read the brain dump line by line, mapped each idea/intent/quality to the PRD+addendum, and flagged anything **missing, weakened, distorted, or added in a way that contradicts stated intent**. Special attention to qualitative "spirit" items (tone, feel, emphasis, restraint) that a structured FR list tends to silently lose.

Overall: the PRD is thorough and captures the vast majority of the brain dump's concrete requirements faithfully (persistence, optimistic UX, empty/loading/error states, responsiveness, extensible-but-not-multi-user architecture, out-of-scope list, success metrics). The gaps below are mostly about **scope additions that push against the brain dump's central quality — restraint/minimalism** — plus one reframing of intent.

---

## GAPS

### G-1 — "Edit" was added as a core action; the brain dump never asked for it (scope addition, tension with minimalism)

The brain dump names its core actions precisely and repeatedly: *"creation, visualization, completion, and deletion of todo items"* — **four** actions, no editing. It never mentions editing a todo's text.

The PRD elevates editing into a first-class core action:
- Overview calls the core loop "create, view, **edit**, complete, delete" (line 17).
- G1 lists "create, view, **edit**, complete, delete" (line 27).
- SM1 measures "all **5** core actions" (line 41).
- An entire Feature C (FR9–FR11) is devoted to in-place editing with optimistic save, blur/Enter confirm, and Esc-revert.

This is the single most significant divergence. It is not merely an extra FR — it redefines the product's success metric (4 actions became 5) and adds meaningful UI/state complexity (inline edit affordance, confirm/cancel/revert semantics). It directly pushes against the brain dump's most-repeated instruction: *"avoiding unnecessary features or complexity"* and *"deliberately minimal scope."* Editing may well be a reasonable product decision, but it was **not** in the source and should be flagged/confirmed rather than silently absorbed as "core."

### G-2 — Undo-on-delete was added; the brain dump asked only for simple deletion (scope addition, tension with minimalism)

The brain dump says only *"deletion of todo items"* — a plain delete. The PRD introduces Feature E (FR13–FR15) with an **Undo toast** that persists ~5 seconds before the delete is committed, plus a resolved open question (OQ2) pinning the toast duration.

Undo is a genuinely nice UX safety net, but it adds asynchronous "pending commit" state and reconciliation logic that a minimal app did not request. Same spirit concern as G-1: cumulative additions erode the "clean, reliable **core**" and "restraint" that the brain dump treats as the product's whole point.

### G-3 — Reframed as a "portfolio piece / engineering showcase" with a secondary audience the brain dump never named (distortion of intent/emphasis)

The brain dump frames maintainability strictly in service of the **product and future developers**: *"easy to understand, deploy, and extend by future developers."* There is **no** mention of a portfolio, a reviewer, or the app existing to *demonstrate* engineering skill.

The PRD introduces this framing prominently:
- Overview: "As a portfolio piece it doubles as a demonstration of clean full-stack engineering" (line 17).
- A **secondary audience**: "a portfolio reviewer evaluating full-stack engineering quality" (line 22).
- G5 "Engineering showcase … legible enough to serve as a portfolio demonstration" (line 34).
- SM5 and the addendum rationale repeatedly justify decisions as a "portfolio signal."

This is a distortion of emphasis. The brain dump's north star is a clean, reliable **end-user product**; maintainability is a means to that end. The PRD partially re-centers the document around impressing a reviewer, and — importantly — some downstream decisions are then justified *by* this invented audience (see G-4). If the portfolio framing is a real, separately-known requirement, that's fine; but it did **not** come from this source input and it visibly shapes scope/tech choices, so it should be confirmed.

### G-4 — "Simplicity / easy to deploy" pressured by tech choices optimized for a future the brain dump only said to "not prevent" (tension/possible contradiction)

The brain dump sets a **light** bar for future-proofing: auth/multi-user *"are not required"* and the architecture *"should not prevent these features from being added later."* Not "optimize for," just "don't block." Simultaneously it lists **simplicity** and *"easy to … deploy"* among the top non-functional priorities.

The addendum instead makes choices actively optimized for the multi-user future:
- PostgreSQL in its own container, **explicitly chosen over SQLite** "because it supports the future multi-user direction cleanly" (addendum line 11).
- A separate Next.js frontend + separate Gin API service, justified partly as a "portfolio signal" and multi-user path (addendum lines 9, 16).

A three-service, Postgres-backed, multi-container stack is more operationally heavy than the brain dump's "simple / easy to deploy" spirit implies (a single-file SQLite store would be the minimalist reading). `docker compose up` mitigates the friction, but the *reasoning* ("multi-user direction," "portfolio signal") goes beyond the brain dump's "don't prevent" bar and is partly driven by the invented portfolio audience (G-3). Worth a conscious confirmation that this added infrastructure is wanted, not assumed.

### G-5 — The pervasive "restraint / minimalism" spirit is diluted by cumulative additions (qualitative)

Taken individually each addition is defensible; taken together they blunt the brain dump's dominant quality. The source hammers restraint four separate ways: *"avoiding unnecessary features or complexity," "deliberately minimal scope," "clean and reliable core experience," "focused."* The PRD adds edit (G-1), undo (G-2), a 500-char limit with approaching-limit feedback (FR24), and a forward-looking `status` enum (FR19) — none present in the source.

The PRD does try to defend this spirit (CM1 "No scope creep," Out-of-Scope section), which is good. But CM1 guards only against going *beyond the PRD's own defined scope* — it does not catch the fact that the PRD's defined scope already grew past the brain dump. The restraint is now measured against a larger baseline than the user set.

---

## Minor / Notes (not primary gaps)

- **500-character cap (FR24)** — reasonable engineering hardening, but not in the source. Low concern.
- **`status` enum vs. boolean (FR19)** — extensibility decision, arguably justified by "don't prevent future"; low concern, though it's another small complexity the source didn't request.
- **Accessibility explicitly deferred (line 145, addendum line 23)** — the brain dump never mentions accessibility, so deferring it doesn't drop a stated requirement. Mild tension only: the source's "polished user experience" and "works well across devices" could be read to imply baseline a11y. Fine to leave deferred, but note it.
- **Well-captured, no gap:** immediate list-on-open with no onboarding (G1/FR5/CM3), optimistic instant feel (NFR1/FR2), completed-vs-active visual distinction (FR7), empty/loading/error states (Feature G), desktop+mobile (NFR5), CRUD + durability across sessions (Feature F/NFR3), extensible-not-multi-user architecture (NFR8), client+server error handling (NFR9), the full out-of-scope list, and "feels like a complete product despite minimal scope" (Overview). All faithfully preserved.

## Recommendation

Confirm with the user, in priority order: (1) is **editing** actually wanted as a core action, or was it inferred? (2) is **undo-on-delete** wanted, or is plain delete the intent? (3) is the **portfolio/showcase** framing a real requirement, and if not, should the Postgres/multi-service choices be revisited against the "simple, easy to deploy" priority? Everything else is a faithful or defensible rendering of the source.
