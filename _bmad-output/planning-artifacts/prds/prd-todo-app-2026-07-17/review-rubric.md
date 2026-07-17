# PRD Quality Review — Todo App

## Overall verdict

For a deliberately minimal, portfolio-stakes single-user Todo app, this is a genuinely good PRD: it has a real thesis ("the product's value *is* its restraint"), the features serve that thesis, and almost every requirement carries a testable consequence with named thresholds rather than adjectives. What holds up is the scope discipline (explicit Out of Scope + Future Considerations, resolved Open Questions, counter-metrics that actively guard the thesis) and the clean ID hygiene. What's mildly at risk downstream is the absence of a Glossary and of any user-journey framing to feed UX/story creation — both defensible at this surface size, but worth a conscious call rather than an omission. No blocking issues.

## Decision-readiness — strong

A reviewer or downstream architect can act on this today. The two Open Questions are actually closed with dated resolutions (OQ1 → PostgreSQL, OQ2 → "~5 seconds"), and the addendum's "Rationale / Decisions Considered" surfaces the real forks honestly: Postgres *over* SQLite, separate Gin API *over* Next.js full-stack routes, `status` enum *over* a `completed` boolean. These are stated as decisions, not smuggled in as "considerations." Counter-metrics (CM1–CM3) are the strongest signal here — the PRD names how it could win a metric the wrong way (CM2: "Optimistic updates roll back visibly on server failure — no silent divergence"), which is exactly the honesty the dimension rewards.

### Findings
- **low** Trade-offs name the winner but not the cost (addendum §"Rationale") — Postgres-over-SQLite is justified by the multi-user future, but the counter-cost (heavier infra than a demo strictly needs) is unstated; likewise the separate-service split adds deploy/CORS surface. Reads slightly one-sided. *Fix:* one clause per decision naming what was given up (e.g., "at the cost of a heavier local stack, mitigated by NFR11's single `docker compose up`").

## Substance over theater — strong

No furniture. There are no personas to inflate — the PRD names a "Primary user" and a "Secondary audience" in one line each and moves on, which is the right amount for this surface. The Overview earns its keep with a specific bet ("it feels like a complete, polished product despite its small surface"), not a swappable vision cliché. Most NFRs carry product-specific thresholds (≤100ms, p95 ≤300ms, ~375px, ≤10 min clone-to-run) rather than boilerplate "must be scalable/secure."

### Findings
- **low** A few NFRs lean on adjectives (§5) — NFR6 "clean, conventional, and readable … without tribal knowledge" and NFR9 "no unhandled crashes in normal use" are not directly measurable. They're partly redeemed by testable proxies (SM5/NFR7's ≤10-min clone-to-run), but as written they're the closest thing here to NFR theater. *Fix:* lean on the proxy explicitly, or add a concrete signal (lint/format config committed, CI green) so "clean" has a checkable referent.

## Strategic coherence — strong

The PRD has a clear, sustained thesis with two coherent audiences (effortless product for the user, clean full-stack showcase for the reviewer) and the whole document bets on it. Feature ordering follows the core loop (create → view → edit → complete → delete → persistence → resilience) rather than "what's easy first." Success Metrics validate the thesis rather than measuring vanity activity — SM1 tests unaided task completion (the "effortless" claim), SM5 tests the engineering-showcase claim — and there is no DAU/MAU tell. Counter-metrics reinforce the arc, especially CM1 ("No scope creep … even if easy to add"), which turns restraint from a slogan into a guardrail. This is not a backlog with headings.

## Done-ness clarity — adequate

Strong for the stakes, with a couple of soft edges. The large majority of FRs are testable: FR2 (optimistic insert with `status=active` + timestamp), FR8 (newest-first), FR11 (empty edit reverts), FR19 (record shape + enum), FR24 (500-char cap, client+server). The cross-cutting UX states (FR20–FR23) are enumerated rather than hand-waved, which is where PRDs usually get lazy.

Two gaps worth naming. First, the delete/undo lifecycle has an unspecified edge: FR13 removes the todo optimistically, FR14 holds an Undo toast "~5 seconds," and FR15 commits "if not undone" — but what happens if the user closes the tab or navigates away during that window is undefined (is the delete committed, or does the todo reappear on reload?). This is the one place where "done" is genuinely ambiguous for an implementer. Second, a handful of adjective phrases carry acceptance weight without bounds.

### Findings
- **medium** Undo-window lifecycle underspecified (FR13–FR15) — the ~5s "pending delete" state has no defined behavior on tab close / reload / a second mutation on the same row before commit. A downstream engineer must invent the semantics. *Fix:* state whether an uncommitted delete survives a reload (recommend: commit-on-unload or treat as not-deleted) and one line on interaction with concurrent edits.
- **low** Adjective-graded acceptance (FR3, FR22, NFR2) — "clear, non-disruptive feedback" (FR3), "non-disruptive message with a retry path" (FR22), and "no perceptible blank-screen delay" (NFR2) will be interpreted per-implementer. Minor because each has a concrete anchor nearby (retry path, loading state). *Fix:* where cheap, bound them (e.g., inline validation appears within one interaction; retry re-issues the failed request).

## Scope honesty — strong

Among the best dimensions here. §6 Out of Scope does real work — it enumerates the tempting adjacencies (auth/multi-user, priorities, deadlines, reminders, tags, search, recurring) rather than leaving the reader to infer them — and §7 Future Considerations distinguishes "deferred, not rejected," explicitly for accessibility ("deferred, not rejected — see Future Considerations"). Open-items density is appropriately near-zero for a green-light-to-build artifact: both OQs resolved. The `status`-enum decision is even pre-emptively defended against a scope-creep objection ("Treated as an extensibility decision, not scope creep, since v1 still surfaces only the two states").

### Findings
- **low** Unconfirmed inferences aren't tagged (FR24; SM1/SM3 targets) — the 500-char cap, the "5/5 test users / 0 hints" bar, and the ≤100ms/≤300ms numbers read as decisions but are almost certainly PM-chosen defaults rather than user-confirmed. In a heavier PRD these would carry `[ASSUMPTION: …]`. Low, given stakes and that they're all easily adjustable. *Fix:* mark the picked-number thresholds as assumptions so downstream knows they're tunable, not sacred.

## Downstream usability — adequate

This PRD is chain-top (it feeds architecture, UX, and story creation), so traceability matters more than for a standalone. ID hygiene is clean: FR1–FR24, SM1–SM5, NFR1–NFR11, G1–G5, CM1–CM3, OQ1–OQ2 are all contiguous and unique, and cross-references resolve (SM3↔NFR1, CM2↔FR23, NFR8 threaded through the addendum). Sections mostly stand alone.

The gap is the absence of a Glossary. Domain nouns are used consistently in practice — "todo," "`status`," `active`/`completed`, "optimistic," "toast" — and the vocabulary is small enough that drift risk is low, but a chain-top PRD feeding three downstream workflows benefits from one canonical definition list (especially for `status` and its future values, and for "committed" vs "optimistic" state, which the undo flow blurs).

### Findings
- **medium** No Glossary for a chain-top PRD (whole doc) — downstream UX/architecture/story workflows have no single source for `status` (and its reserved future values), "optimistic vs persisted/committed," or "todo." Currently these are defined in-line at FR19 and scattered. *Fix:* add a short Glossary; it will also disambiguate the undo lifecycle terms flagged above.

## Shape fit — adequate

The PRD is deliberately shaped as a capability spec (Features → FRs), and for a single-user app whose entire surface is a five-verb core loop that is a reasonable fit, not an over-formalized one. It is not padded with UJ ceremony it doesn't need. The counter-pressure: the rubric treats named-protagonist User Journeys as load-bearing for consumer products with meaningful UX, and this *is* a consumer-facing product whose whole pitch is experience quality ("feels like a complete, polished product," empty/loading/error states as first-class). The flows are trivial enough that FRs carry the intent, so I'd call this a conscious under-formalization rather than a misfit — but downstream UX/story creation would benefit from at least one thin journey to anchor the "polished feel" claim, particularly the add→edit→complete→delete-with-undo happy path where the interaction nuance actually lives.

### Findings
- **low** No user journeys for an experience-led consumer product (whole doc) — defensible given the tiny surface, but the "instant-feeling, polished" thesis (G3) and the undo interaction are exactly where a single UJ would pay off for UX/story work. *Fix:* add one happy-path UJ with a named protagonist covering capture→edit→complete→delete/undo; skip the rest.

## Mechanical notes

- **IDs:** Contiguous and unique across all series (FR1–24, SM1–5, NFR1–11, G1–5, CM1–3, OQ1–2). No gaps or duplicates found.
- **Cross-references:** All resolve — SM3↔NFR1, CM2↔FR23, G-goal links in the SM table, NFR8 referenced consistently in the addendum. No "see above" dangling refs.
- **Glossary / drift:** No Glossary present (see Downstream usability). Terminology is nonetheless consistent: `status`/`active`/`completed`, "optimistic," "toast," "todo" used identically throughout. Minor: "datastore" vs "backend" vs "server" used loosely around FR16–FR18/NFR3 — harmless but a Glossary would settle it.
- **Assumptions Index:** No `[ASSUMPTION]` tags used (see Scope honesty finding). No index needed at this stakes level, but the picked-number thresholds are un-flagged inferences.
- **Sections present:** Overview, Goals, Success Metrics + Counter-metrics, Features/FRs, NFRs, Out of Scope, Future Considerations, Open Questions all present; addendum cleanly separates tech stack and rationale. Required sections for these stakes and product type are all accounted for.
