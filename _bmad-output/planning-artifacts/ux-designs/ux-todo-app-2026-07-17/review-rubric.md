# Spine-Pair Validation — DESIGN.md + EXPERIENCE.md (todo-app)

**Overall verdict: STRONG, with two must-fix broken token references.** The pair is a clean, well-disciplined contract: canonical section order is exact, every frontmatter token carries a hex (with full light/dark pairs) and every component object reference resolves, the single PRD user journey is fully rendered with protagonist/steps/climax/failure path, and all cross-cutting states are first-class. The only real defects are two dead `{path.to.token}` references inside EXPERIENCE.md prose (`{colors.ink.muted}` and `{type.wordmark}`), which violate the "every reference resolves" bar; everything else is polish (orphan palette mock, component-name register drift, minor over-precision).

## 1. Flow coverage — strong

Checked: PRD §3 exposes exactly one journey (UJ1 — Maya). EXPERIENCE.md renders `UJ1 — Maya clears her head between meetings` verbatim, with named protagonist (Maya), 9 numbered steps, an explicit `CLIMAX` beat (step 5, check-off), and a failure path (rollback/CM2 + load-error `Try again`). All five core-loop actions (create/view/edit/complete/delete) appear as steps. No misses.

### Findings
- None.

## 2. Token completeness — broken

Checked: every YAML frontmatter token, every component-object `{...}` reference, and every prose reference in both files. All 18 color tokens carry hex and form complete light/dark pairs; all `rounded`, `spacing`, `typography`, and `components` references in DESIGN.md (frontmatter + prose) resolve. Contrast is stated as qualitative intent, honestly scoped to the deferred-a11y note — acceptable. The two failures below are both in EXPERIENCE.md prose.

### Findings
- **[high]** `{colors.ink.muted}` does not resolve — `colors` is a flat kebab-case object, so the token is `ink-muted`, not the dotted/nested `ink.muted` (EXPERIENCE.md line 96, "Active vs completed row"). It points at a load-bearing completed-state color. *Fix:* change to `{colors.ink-muted}`.
- **[high]** `{type.wordmark}` does not resolve — the frontmatter namespace is `typography`, not `type` (EXPERIENCE.md line 53, Wordmark copy row). *Fix:* change to `{typography.wordmark}`.

## 3. Component coverage — strong

Checked: every component named in either file. All 7 interactive components in EXPERIENCE.md Component Patterns (add input, task row, checkbox/toggle, edit-in-place, delete, theme toggle, placeholder avatar) have matching DESIGN.md visual specs and frontmatter token blocks. DESIGN.md's additional entries (char-counter, undo-toast, skeleton-row, empty/error/retry, description-clamp, add-button) all carry behavioral coverage in EXPERIENCE.md — but in State Patterns / Interaction Primitives rather than the Component Patterns table. No component lacks both a visual and a behavioral home.

### Findings
- **[low]** Char counter, undo toast, skeleton rows, and "more"-reveal have behavior only in State Patterns / Interaction Primitives, not the Component Patterns table — a consumer scanning that table alone under-counts the component set. *Fix:* add stub rows (or a cross-reference) so the Component Patterns table is the complete index.

## 4. State coverage — strong

Checked: the IA is essentially one surface (The List) plus three transient layers. State Patterns covers empty, loading (skeleton, no blank frame), error (warm, non-alarm), optimistic rollback, active-vs-completed row, editing row, pending-delete, and char-limit-approaching; dark-mode variants are carried in DESIGN + mocks. Every state a consumer must build is committed. No misses.

### Findings
- **[low]** Reduced-motion behavior is explicitly undecided (Accessibility Floor `[NOTE FOR UX]`). Honestly flagged and inside deferred a11y, so acceptable for v1 — noted only so downstream knows the spring/pop have no committed degraded path yet. *Fix:* none required for v1; resolve at a11y hardening.

## 5. Visual reference coverage — adequate

Checked: `.working/` holds `key-list.html`, `key-states.html`, `color-themes-1.html`, `prd-extraction.md`. EXPERIENCE.md links `key-list.html` + `key-states.html` inline with a one-time "spine wins on conflict" clause (line 43) — correct. `mockups/` absence is the expected pre-promotion state, not flagged. imports/ is empty.

### Findings
- **[low]** `color-themes-1.html` is an orphan — referenced by `.memlog.md` but by neither spine. It is a superseded palette exploration (its chosen hexes now live in DESIGN.md frontmatter), so low impact. *Fix:* drop it at promotion, or note it as superseded exploration.
- **[low]** DESIGN.md links no visual reference at all, though `key-list.html` renders its light/warm-dark color and composition story. *Fix:* add an inline pointer from DESIGN.md Colors/Brand to `key-list.html` (with the same spine-wins caveat).

## 6. Bloat & overspecification — strong

Checked: pixel-vs-token discipline, source restatement, prose-vs-table, and editorial-voice placement. DESIGN.md uses tables for colors/type/shapes/do's, carries editorial voice appropriately, and hard-codes only values with no token (checkbox 22px, the two shadow strings). EXPERIENCE.md is behavioral and table-driven. FR/NFR citations throughout read as traceability, not padding.

### Findings
- **[low]** A few responsive type sizes are over-precise in prose ("up to 17.5px on wide desktop panels", "23px on mobile", "≈18px" mobile padding) where the token scale otherwise carries sizing (DESIGN.md Typography / Layout). *Fix:* round or tokenize; 17.5px in particular reads fiddly.
- **[low]** Mild editorial voice bleeds into EXPERIENCE.md's intro blockquote and flow narration ("done cleanly enough to feel finished"; "a loose worry, visibly closed"). Flow prose is inherently narrative so this is tolerable, but the intro could be trimmed to contract voice. *Fix:* optional tightening of the EXPERIENCE.md intro.

## 7. Inheritance discipline — adequate

Checked: sources frontmatter resolvability, UJ verbatim match, component-name identity across sections, and EXPERIENCE→DESIGN token resolution. All `sources` paths resolve (prd.md, .memlog.md, prd-extraction.md, key-list.html, key-states.html). UJ1 name is verbatim. Token-resolution failures are captured in §2. The remaining issue is naming register.

### Findings
- **[low]** Component names are not identical across sections: frontmatter kebab (`add-input`, `task-row`, `delete-button`, `avatar-placeholder`) vs DESIGN.md body Title-case (`Add-input`, `Task row (active)`, `Delete affordance`, `User avatar`) vs EXPERIENCE.md labels (`Add input`, `Task row`, `Delete`, `Placeholder avatar`). Mappable by a human, but a name-keyed extractor must fuzzy-match. *Fix:* pick one canonical name per component and use it verbatim in all three places (or add the frontmatter key in parentheses in each body heading).

## 8. Shape fit — strong

Checked: DESIGN.md section order and EXPERIENCE.md required defaults. DESIGN.md follows canonical order exactly (Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts). EXPERIENCE.md carries all required defaults (Foundation, IA, Voice and Tone, Component Patterns, State Patterns, Interaction Primitives, Accessibility Floor, Key Flows). Accessibility Floor is exemplary on the honesty axis — it names the minimal respected floor and enumerates exactly what is deferred, matching the PRD's deferred-not-rejected stance. No invented sections.

### Findings
- **[low]** `Responsive & Platform` and `Inspiration & Anti-patterns` are omitted. Both are defensible — responsive is folded into Foundation/Layout under "same composition at every width, never a distinct mobile app," and the Trello touchstone lives in DESIGN.md Brand & Style. Noted only to confirm the drops are deliberate, not accidental. *Fix:* none required.

## Mechanical notes

- Broken references are confined to two prose "see" pointers in EXPERIENCE.md (lines 53, 96); the behavioral rule and the underlying token value are still stated in words, so a consumer is degraded, not blocked — but a strict resolver will report two unresolved references.
- All 18 DESIGN.md component-object token references and all 16 distinct DESIGN.md prose references were checked individually and resolve.
- `rounded.lg` (16px) is defined and described (app/browser frame) but not consumed by any component token — intentional, not a gap.
- `.memlog.md` line 15 still says "approaching 500 cap" — a stale early-extraction figure explicitly overridden on line 19 (title 200 / description 2000). Both spines correctly use 200/2000; the stale line is a log artifact, not a spine defect.
- Finding counts: critical 0 · high 2 · medium 0 · low 9.
