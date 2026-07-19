---
title: 'Progressive character-limit feedback'
type: 'feature'
created: '2026-07-19'
status: 'done'
baseline_revision: '4750bf3'
final_revision: '6b8c6b1d7f4e84055eb8acc2d998ccfa9ff415ec'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
warnings:
  - oversized
---

<intent-contract>

## Intent

**Problem:** The text fields enforce caps (submit/save blocks over-cap — already built) but give no visible sense of how close you are to the limit. A user should be guided as they approach a cap, without clutter at rest.

**Approach:** Web-only. Add a quiet `meta`-size char counter to the three capped fields (add-title, inline-edit title, inline-edit description). It is hidden at rest, appears within 20 of the cap (RD-2), shows `current / total` with the current number in `--accent` bold, and counts Unicode code points (server-consistent). Extract the duplicated cap constants + `codePoints` into a shared module and a reusable `CharCounter`. The cap-blocking behavior (RD-3) already exists and stays unchanged.

## Boundaries & Constraints

**Always:**
- The counter is **hidden** while `codePoints(value) < cap − 20`; it **appears** within 20 of the cap (title ≥180/200, description ≥1980/2000 — RD-2) and shows `current / total` (e.g. `184 / 200`), the **current number** in `--accent` + bold, the `/ total` in `--ink-secondary`, at `meta` size (13px). Over cap it shows the overage (`201 / 200`), staying `--accent` bold.
- The count is **Unicode code points** via the shared `codePoints` (`[...s].length`), matching Go `utf8.RuneCountInString` (AD-10). The counter counts the **raw** field value (what the user sees); the **block** guard keeps counting the **trimmed** value (unchanged).
- Over-cap **still blocks** submit (AddInput) and save (TodoRow editor) — RD-3, existing behavior, must not regress. The field keeps its `aria-invalid` over-cap.
- The counter is **decorative** (a non-focusable `<span>`, no `aria-live`) — the field's `aria-invalid` is the authoritative assistive-tech signal. All colors from existing tokens (`--accent`, `--ink-secondary`).

**Block If:**
- Realizing the counter requires a color the token set lacks (a red/danger token) — it must not; use `--accent` (see Design Note 1). Adding a `--danger` token reverses the documented no-alarm-red voice rule and is a design-owner decision, not an unattended one.

**Never:** No alarm-red / new `--danger` token / hardcoded hex (accent-only). No change to the RD-3 block logic or the caps. No change to `--ink-secondary`/`--ink-muted` token values (Story 3.5). No theme toggle (3.4). No `aria-live`/announcement stream. No dropping keystrokes (over-cap typing stays allowed).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| at rest | title ≤179 code points | no counter rendered | — |
| approaching | title 180–200 | counter `180 / 200 … 200 / 200`, current number accent+bold | — |
| at cap | title exactly 200 | `200 / 200`, accent bold; submit still allowed (200 ok) | — |
| over cap | title 201 | `201 / 200`, accent bold; submit **blocked** (existing) | block |
| description | desc ≥1980 | `1980 / 2000 …`, same behavior at the 2000 cap | — |
| code points | 200 astral emoji title | counter shows `200 / 200` (not 400) | — |
| grapheme | a 5-code-point ZWJ family emoji | counts as 5 (not 1) — appears/blocks accordingly | — |
| raw vs trim | trailing spaces near the boundary | counter counts raw (spaces tick it up); block still counts trimmed | — |
| a11y | axe scan of the fields/editor | counter adds zero non-contrast violations; decorative span | — |

## Code Map

- `web/lib/caps.ts` -- **new** shared `MAX_TITLE = 200`, `MAX_DESCRIPTION = 2000`, `codePoints(s) = [...s].length`. Replace the duplicated copies in AddInput + TodoRow.
- `web/app/components/CharCounter.tsx` -- **new** `CharCounter({ value, max })`: computes `codePoints(value)`; renders nothing when `< max − 20`; otherwise a non-focusable `<span>` `{n} / {max}` (current `n` in `--accent` bold, `/ max` in `--ink-secondary`), `meta` 13px, right-aligned.
- `web/app/components/AddInput.tsx` -- import caps from `caps.ts` (drop the local `MAX_TITLE`/`codePoints`); render `<CharCounter value={value} max={MAX_TITLE} />` as a full-width row (`flexBasis:100%`, right-aligned) below the input. Over-cap block unchanged.
- `web/app/components/TodoRow.tsx` -- import caps from `caps.ts` (drop the local copies); render `<CharCounter value={titleDraft} max={MAX_TITLE} />` after the title `<input>` and `<CharCounter value={descDraft} max={MAX_DESCRIPTION} />` after the `<textarea>`, inside `editorRef` (non-focusable, won't trip save-on-blur). Over-cap block unchanged.
- `web/app/globals.css` -- no change expected (CharCounter uses inline token styles; plain color/weight swap needs no motion guard). If a fade-in is added, gate it behind `prefers-reduced-motion`.

**Tests:**
- `web/tests/char-counter.test.tsx` -- **new**: hidden below `max−20`; visible within 20; format `n / max`; current number accent+bold; code-point count incl. an astral-emoji + ZWJ-family boundary (shows code points, not UTF-16 units).
- `web/tests/caps.test.ts` -- **new (small)**: `codePoints` counts code points (astral + ZWJ), `MAX_*` values.
- `web/tests/add-input.test.tsx`, `web/tests/todo-row.test.tsx` -- extend: counter appears near cap; **over-cap still blocks** submit/save (re-run the existing RD-3 assertions — no regression); add a description-cap counter+block case for TodoRow.
- `web/tests/e2e/a11y.spec.ts` -- the existing editor/field scans cover the counter; confirm zero new non-contrast violations (no new scan needed unless convenient).

## Tasks & Acceptance

**Execution:**
- [x] `web/lib/caps.ts` -- shared `MAX_TITLE`/`MAX_DESCRIPTION`/`codePoints`.
- [x] `web/app/components/CharCounter.tsx` -- the quiet progressive counter (hidden < max−20; `n / max`; accent-bold current number).
- [x] `web/app/components/AddInput.tsx` -- use `caps.ts`; render the title counter; block unchanged.
- [x] `web/app/components/TodoRow.tsx` -- use `caps.ts`; render title + description counters; block unchanged.
- [x] tests -- CharCounter/caps units; extend add-input/todo-row (near-cap counter + over-cap block regression + description cap).

**Acceptance Criteria:**
- Given a capped field, when the text approaches its cap (title 200 / description 2000), then a quiet `meta`-size counter appears (hidden at rest, within 20 per RD-2).
- Given the counter is shown, when the value nears or exceeds the cap, then the current number turns `--accent` and bold; the cap is counted in Unicode code points, consistent with server-side validation.
- Given the value is over cap, then submit/save remains blocked (RD-3, unchanged) and the field stays `aria-invalid`.

## Design Notes

Resolutions (conservative, from DESIGN authority — for PR ratification):

1. **Accent, not red (the one to ratify):** the AC says "turns accent and bold" and DESIGN (the design spine, which "wins on conflict") specs `char-counter.near-limit-color: accent` with **no red/over-cap color**; the token set has **no danger/red token**; and the no-alarm-red voice rule is actively enforced in shipped code. So the over-cap state stays `--accent` + bold and conveys "over" via the overage number (`201 / 200`) + the field's `aria-invalid` + the (existing) blocked submit — **not** a red token. RD-3's literal "red/negative" is treated as satisfied-in-intent. If the owner mandates a distinct over-cap color, that is a deliberate `--danger` token addition reversing the voice rule — left for sign-off, NOT done unattended.
2. **Format `184 / 200`** (current / total, spaces around the slash; DESIGN:282), current number emphasized. Over cap → `201 / 200`.
3. **Threshold within 20** (RD-2): hidden `< cap−20`, visible `≥ cap−20`.
4. **Counter counts the raw value** (what the user sees, so a trailing space ticks it up); the **block** guard keeps counting `trim()`. They can diverge by trailing whitespace near the boundary — pinned in a test.
5. **Decorative**, no `aria-live` (the field's `aria-invalid` is the authoritative signal; a per-keystroke live region would be noisy).
6. **Shared extraction:** `caps.ts` (dedup `MAX_TITLE`/`MAX_DESCRIPTION`/`codePoints`, currently byte-identical in two files) + a reusable `CharCounter` — the three fields wire to one component.

## Verification

**Commands:**
- `cd web && npm run test:unit && npm run lint && npm run format:check && npx tsc --noEmit` -- all green (incl. CharCounter/caps units + the unchanged RD-3 block assertions).
- `cd web && npm run test:e2e:p0` -- a11y + field specs green (counter adds no violation).

**Manual checks:**
- `docker compose up`: type in the add-input — no counter until ~180 chars, then `184 / 200` with an accent-bold number; type past 200 → `201 / 200`, Add blocked; paste 200 emoji → `200 / 200` (not 400); open an inline editor and near the caps on both the title and description → per-field counters; nothing at rest.

## Review Triage Log

### 2026-07-19 — Expert review pass (Pixel [web]; web-only story, no Gopher)
- intent_gap: 0
- bad_spec: 0
- patch: 1 (low 1)
- defer: 0
- reject: 2 (informational — pre-existing / by-design)
- addressed_findings:
  - `[low]` `[patch]` P1 — AddInput's always-rendered `flexBasis:100%` counter wrapper left an ~8px flex-gap row at rest (contradicting "no clutter at rest"). Moved the layout onto the counter via a `style` prop so at rest NOTHING renders (no wrapper). TodoRow was already fine (renders the counter directly, no wrapper).
- rejected (informational, not this story's introduction):
  - P2 — `--accent` at 13px bold on `--surface-raised` ≈ 4.3:1 (under AA 4.5) — but a pre-existing accent-at-13px pattern (retry/reveal buttons), token-frozen (Story 3.5 owns contrast), and DESIGN ratifies `char-counter.near-limit-color: accent`. The a11y lane excludes `color-contrast` AND the counter is hidden during the scan, so the lane is blind to it (the inverse of 3.1/3.2). Left for the 3.5 contrast decision.
  - P3 — SR users get no proximity feedback (counter `aria-hidden`, `aria-invalid` flips only over-cap) — exactly per spec Design Note 5 (decorative; the block/aria-invalid are authoritative). By design.
- Pixel verified the `caps.ts` extraction is **byte-identical / behavior-preserving** (every use-site migrated, RD-3 block + boundaries unchanged) and no strict-mode/route-announcer locator risk was reintroduced (the 3.1/4.2 trap avoided).

## Auto Run Result

Status: done

**Summary:** Story 3.3 (progressive character-limit feedback) — web-only. A quiet `meta`-size `CharCounter` on the three capped fields (add-title, edit-title, edit-description): hidden at rest, appears within 20 of the cap (RD-2), `n / max` with the current number `--accent` bold, code-point counted (AD-10). Over cap shows the overage + keeps accent-bold — no red/danger token (DESIGN + AC over RD-3's literal "red"; flagged for UX ratification). The RD-3 cap-block already existed and is unchanged. Extracted a shared `caps.ts` (dedup) + a reusable `CharCounter`. Pixel review → 1 patch (a resting phantom-gap), 2 informational rejects.

**Files changed:** web — `lib/caps.ts` (new: shared `MAX_TITLE`/`MAX_DESCRIPTION`/`codePoints`), `components/CharCounter.tsx` (new), `components/AddInput.tsx` + `components/TodoRow.tsx` (use caps + render counters; blocks unchanged), tests `char-counter.test.tsx` + `caps.test.ts` (new) + extended `add-input.test.tsx`/`todo-row.test.tsx`.

**Review findings:** 1 patch (low), 0 deferred, 2 rejected (informational), 0 intent-gaps, 0 bad-spec loopbacks.

**Verification:** web `npm run test:unit` → 102 passed; eslint + prettier + tsc clean (no new errors). E2E a11y lane runs at CI (the counter is decorative/aria-hidden, adds no violation).

**Residual risks:** (1) the accent-vs-red decision (Design Note 1) — over-cap uses `--accent` not a red token — is the one item flagged for UX ratification at the PR gate. (2) `--accent` counter contrast (~4.3:1) is a pre-existing token issue owned by Story 3.5, not touched here. Hence `followup_review_recommended: true` for a browser/UX pass.
