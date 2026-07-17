# Reconciliation Review — ARCHITECTURE-SPINE vs PRD + Addendum

**Date:** 2026-07-17
**Scope:** Every FR (FR1–FR24), NFR (NFR1–NFR11), success metric (SM1–SM5), and counter-metric (CM1–CM3) checked against the spine's ADs, conventions, diagrams, and structural seed. Goal: find what the PRD/addendum require that the spine failed to land, plus any contradictions.

**Known, pre-accepted divergences (confirmed, not counted as findings):**

1. **Next.js BFF proxy instead of browser-direct + CORS.** Confirmed present in AD-3 / structural seed. The addendum's rationale explicitly anticipated a "cross-origin (CORS) surface"; the spine deliberately eliminates it by making the browser call same-origin `web`, which proxies `/api/*`. Reconciled deliberately — OK.
2. **`updatedAt` + nested `metadata` vs the PRD's flat `createdAt`.** Confirmed present in AD-6 / AD-7. Note for the reconcilers: the PRD does **not** actually ask for `createdAt`-only — FR2, FR19, and the glossary all require both `created_at` and `updated_at` as system-managed timestamps. So the only genuine divergence here is the **nesting** (`metadata: { createdAt, updatedAt }`) vs the PRD's flat field list; the `updatedAt` field itself is aligned with the PRD, not an addition. Flagged for accuracy but treated as known/OK.

---

## TOP FINDING — the `title` field was silently dropped; the wire contract collapses two fields into one, with the wrong cap and inverted required-field semantics

This is the one that didn't land, and it cascades across the whole feature set.

**What the PRD requires:** a todo has **two distinct text fields** — a **`title` (required)** and a **`description` (optional, may be blank)**. This is stated everywhere: FR1, FR2, FR6, FR9, FR11, FR16, FR19, FR24, and the glossary. The required, non-empty field is the **title**; the description is optional.

**What the spine says (AD-6):**

```json
{ "id": "uuid", "description": "string", "status": "active", "metadata": {...} }
```

> "One text field, `description` — no `title`, no notes."

The ER diagram (Structural Seed) confirms it: `TODO { uuid id, text description, text status, timestamptz created_at, timestamptz updated_at }` — **no `title` column.**

This is a direct contradiction of the PRD, and it is **not** one of the two pre-accepted divergences. Consequences:

- **FR1 / FR2 / FR9 / FR16 / FR19** — the create/edit/list/CRUD surface loses the primary field. The PRD's core "type a title, optionally add a description" interaction cannot be built from this contract.
- **FR3 / FR11 — required-field semantics are inverted.** AD-10 enforces "non-empty/non-whitespace **description**." But per the PRD the *description* is the **optional** field that "may be blank/cleared," and the **title** is the required one. The spine kept the optional field, dropped the required one, and then applied the required-ness to the field the PRD says is optional. Any implementer following the spine will reject blank descriptions (wrong) and never enforce a required title (missing).
- **FR6** — "display its title, its description (when present)" cannot be honored; only one field exists to render.

**Related contradiction — character caps (FR24).** The PRD: **`title` ≤ 200 chars, `description` ≤ 2000 chars**, both client- and server-side, "with clear feedback as a limit is approached or exceeded." AD-10 instead specifies **"the 500-char cap"** on the single `description` field. The number `500` appears nowhere in the PRD; both the two-field structure and both limits (200 / 2000) are lost, replaced by an invented single 500 cap. Additionally, the FR24 requirement for **feedback as the limit is approached** (a counter, not just a hard reject) is not reflected anywhere in the spine.

**Recommendation:** restore `title` (required) and `description` (optional) as two fields end to end — wire contract (AD-6), ER/schema, validation authority (AD-10, required = title / optional = description), the PATCH partial-update convention ("title and/or description and/or status"), and the caps (title 200, description 2000, plus approaching-limit feedback). This is the single highest-impact correction.

---

## Coverage matrix

### Functional Requirements

| FR | Governed by | Status |
| --- | --- | --- |
| FR1 create (title required + optional desc, Enter/Add) | AD-6, AD-7, AD-10, AD-4 | **Broken** — `title` dropped (see TOP FINDING). Submit affordance (Enter/"Add" button) not specified, but below altitude. |
| FR2 optimistic add w/ title, desc, status, timestamps | AD-4, AD-7 | **Partial** — mechanism governed; `title` missing. |
| FR3 empty/whitespace title rejected + inline feedback | AD-10 | **Inverted** — spine guards `description`, not `title` (see TOP FINDING). |
| FR4 after add, input clears and stays focused | — | **Unaddressed** — no AD/convention. UI micro-behavior, arguably below architecture altitude, but nothing governs it. |
| FR5 list loads automatically on open | AD-4, endpoints (GET /todos) | Governed. |
| FR6 display title, desc, status, relative time | AD-6, AD-7 (relative time), ordering | **Partial** — relative-time render governed; title/desc rendering broken by field collapse. |
| FR7 completed visually distinct (strikethrough/muted) | — (AD-8 governs the value, not the styling) | **Unaddressed** — pure presentation; below altitude but not called out. |
| FR8 newest-first ordering | Ordering convention (`created_at DESC`), AD covers "one source of order" | Governed (well — client never re-sorts). |
| FR9 edit title + desc in place | AD-4, AD-6, AD-10 | **Partial** — title dropped. |
| FR10 save on Enter/blur, optimistic; Esc cancels/reverts | AD-4 (optimistic+rollback) | **Partial** — optimistic path governed; the pre-commit "Esc cancels/reverts" affordance not governed (below altitude). |
| FR11 empty title reverts; desc may be cleared | AD-10 | **Inverted** — see TOP FINDING; spine forbids clearing the field it kept. |
| FR12 toggle status active⇄completed, optimistic, persists | AD-4, AD-8 | Governed. |
| FR13 delete → immediate removal, pending (uncommitted) | AD-5 | Governed (strong). |
| FR14 ~5s Undo toast, cancels w/ no round-trip | AD-5 | Governed. |
| FR15 elapse → commit; reload mid-window = committed | AD-5 | Governed (explicitly). |
| FR16 REST CRUD (create/list/update[title+desc+status]/delete) | Endpoints convention, AD-1 | **Partial** — update scope loses `title`. |
| FR17 durable persistence across restarts/sessions | AD-11, AD-12 (named volume) | Governed. |
| FR18 HTTP status codes + structured errors | AD-9 | Governed. |
| FR19 record fields; status enum extensible; managed timestamps | AD-6, AD-7, AD-8 | **Partial** — enum + timestamps governed; `title` dropped. |
| FR20 empty state friendly prompt | AD-4 (query states) implicitly | **Weak** — TanStack Query yields empty state, but the "friendly prompt to add the first todo" is not called out anywhere. |
| FR21 loading indicator while fetching | AD-4 implicitly | **Weak** — loading state implied by query lifecycle; not explicitly governed. |
| FR22 error state + retry re-issues request | AD-9 | Governed. |
| FR23 optimistic rollback visible | AD-4 | Governed (strong). |
| FR24 caps title 200 / desc 2000, client+server, approaching feedback | AD-10 | **Contradicted** — single 500 cap on one field; approaching-limit feedback absent (see TOP FINDING). |

### Non-Functional Requirements

| NFR | Governed by | Status |
| --- | --- | --- |
| NFR1 optimistic ≤100ms; API p95 ≤300ms | AD-4 (bound) | **Weak** — mechanism (optimistic UI) governed; the numeric performance budget (100ms / p95 300ms) is not stated as an invariant anywhere. |
| NFR2 prompt initial load, no intervening blank screen | AD-4 implicitly | **Weak** — loading state implied; the "no blank screen" guarantee is not expressed. |
| NFR3 durable, consistent, no stale reads | AD-11, AD-12 | Governed. |
| NFR4 graceful degradation, no corrupt/inconsistent state | AD-4 | Governed. |
| NFR5 responsive + polished desktop and mobile from ~375px | — | **Unaddressed** — nothing in the spine governs responsiveness, mobile, or the 375px breakpoint. See finding below. |
| NFR6 clean/conventional code; linter/formatter committed & passing | Structural seed, conventions, SM5 | **Partial** — structure governed; the checkable signal "linter/formatter config committed and passing" is not in the conventions table (testing is explicitly deferred, but lint/format is a stated NFR6 signal, not testing). |
| NFR7 ≤10-min clone-to-run, README, no undocumented steps | AD-12, README in tree | Governed. |
| NFR8 extensible to auth/multi-user without rewrite | AD-2, AD-3 | Governed (strong — repository seam + proxy auth-injection point). |
| NFR9 client+server graceful; no unhandled exception reaches user | AD-9, logging convention (React error boundary) | Governed. |
| NFR10 server-side validation + sanitization | AD-10, security convention | Governed. |
| NFR11 single `docker compose up` brings up full stack | AD-12 | Governed (strong). |

### Success Metrics

| SM | Governed by | Status |
| --- | --- | --- |
| SM1 5/5 users complete 5 actions, 0 hints | (feature completeness A–E) | Indirect — a usability outcome, not an architectural invariant; features enable it. OK. |
| SM2 0 data-loss across refresh/reopen | AD-5, AD-11, AD-12 | Governed. |
| SM3 instant feel ≤100ms / p95 ≤300ms | AD-4 (bound) | **Weak** — same as NFR1; numeric budget not landed. |
| SM4 works at ~375px mobile and desktop | — | **Unaddressed** — same gap as NFR5. |
| SM5 ≤10-min clone-to-run via README | AD-12, README | Governed. |

### Counter-Metrics

| CM | Governed by | Status |
| --- | --- | --- |
| CM1 no scope creep | Deferred section; AD-2 "clean today, no speculative scope param" | **Weak/implicit** — the spirit is present (AD-2 refuses speculative params; Deferred list is disciplined), but CM1 is not bound to any AD as a guardrail. The one thing worth watching against CM1 is the spine's own metadata-nesting addition, which is a known/reconciled divergence. |
| CM2 instant-feel never hides errors; visible rollback | AD-4 (bound) | Governed (strong). |
| CM3 no configuration burden | AD-12 (bound) | Governed (strong). |

---

## Secondary findings (ranked)

### 2. Responsiveness / mobile is silently unaddressed (NFR5, SM4)

NFR5 ("fully functional and visually polished on modern desktop and mobile browsers, from ~375px up") and SM4 ("passes functional + visual check at mobile ~375px and desktop widths") are both explicit, numeric requirements. **No AD, convention, diagram, or the stack table mentions responsiveness, mobile, viewport, or a breakpoint.** It is treatable as a CSS/`web` concern below architecture altitude — but unlike accessibility (which the PRD explicitly *defers*), responsiveness is an in-scope v1 requirement with a concrete target and a success metric attached to it. It should at least be acknowledged as a `web` convention/responsibility so it isn't lost.

### 3. Cluster of UI-level FR details not governed (FR4, FR7, FR10-Esc, FR20, FR21)

Individually minor and arguably below architecture altitude, but each is an explicit PRD requirement with no home in the spine:
- **FR4** — input clears + stays focused after add (rapid entry).
- **FR7** — completed todos visually distinct (strikethrough/muted).
- **FR10** — Esc cancels an in-progress edit and reverts (distinct from server rollback).
- **FR20** — empty state shows a friendly "add your first" prompt.
- **FR21 / NFR2** — loading indicator with no intervening blank screen.

The spine leans on "TanStack Query owns query/mutation states" (AD-4) to imply loading/empty/error, which loosely covers FR20/FR21, but the specific behaviors (friendly empty prompt, no-blank-screen, focus retention, Esc-revert, completed styling) are never named. If the intent is that these live entirely in `web` component code below the spine, a one-line convention noting that would close the gap.

### 4. Performance budget not landed as an invariant (NFR1, SM3)

AD-4 is *bound* to NFR1/SM3, but the actual numbers — optimistic render ≤100ms, API **p95 ≤300ms** under normal load — appear in no AD or convention. Optimistic UI (AD-4) plausibly satisfies the ≤100ms perceived-latency half by construction, but the server-side p95 ≤300ms budget is an unstated target with nothing governing it (no indexing note, no query-shape guidance). Low risk at this scale, but it is a quiet requirement the structure dropped.

### 5. NFR6 lint/format signal missing from conventions

NFR6 names a checkable signal: "linter/formatter config committed and passing." The conventions table covers naming, endpoints, errors, logging, security, config — but not a committed linter/formatter for either `web` or `api`. Testing is legitimately deferred (stated in Deferred), but lint/format is called out separately as an engineering-quality signal, not a test concern.

---

## Summary of what did NOT land

1. **`title` field dropped / two-field model collapsed to one, with the wrong cap (500 vs 200/2000) and inverted required-field semantics** — contradicts FR1, FR2, FR3, FR6, FR9, FR11, FR16, FR19, FR24. Highest impact; not a known divergence.
2. **Responsiveness / mobile ~375px (NFR5, SM4)** — silently unaddressed; no spine element governs it.
3. **UI-behavior cluster (FR4, FR7, FR10-Esc, FR20, FR21/NFR2)** — explicit PRD behaviors with no home; only loosely implied by AD-4.
4. **Performance budget (NFR1/SM3: ≤100ms, p95 ≤300ms)** — bound but never stated as an invariant.
5. **NFR6 linter/formatter-committed signal** — absent from conventions.

Everything else (FR5, FR8, FR12–FR18, FR22, FR23; NFR3, NFR4, NFR7–NFR11; SM2, SM5; CM2, CM3) is cleanly governed. CM1 is only implicitly covered.
