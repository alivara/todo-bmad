---
title: "PRFAQ Distillate: Ember (todo-app)"
type: llm-distillate
source: "prfaq-todo-app.md"
created: "2026-07-19"
purpose: "Token-efficient context for downstream PRD creation"
---

# PRFAQ Distillate — Ember

Companion to `prfaq-todo-app.md`. Upstream inputs: `innovation-strategy-2026-07-19.md`, `research/market-open-source-self-hostable-task-management-research-2026-07-19.md`, `project-context.md`. Concept type: **commercial open-source (COSS)**. Verdict: **NEEDS MORE HEAT** (product ready to spec; business bet contingent on two founder questions).

## Positioning (LOCKED)
- Product name: **Ember** (lowercase wordmark + terracotta dot). Tagline: "the calm daily to-do app you actually own."
- Category framing: **calm, light, effortless-to-own DAILY to-do app** — explicitly ANTI-workspace, anti-bloat, anti-surveillance.
- Launch hero: **privacy-refugee individual** (fled cloud todo over price hike + AI/privacy erosion). Widest funnel.
- Business shape: free AGPL self-hostable core → paid managed hosting (funnel/credibility) → paid TEAM tier (the real revenue; activates AD-2 multi-user seam).

## Rejected framings (do NOT reuse)
- "todo-app" as a name — placeholder, non-shippable.
- "beautiful self-hostable Notion alternative / workspace" — crowded by funded heavy players (AppFlowy, Huly, Plane); undifferentiated.
- "privacy-first task manager" — feature-led not outcome-led.
- Simplicity/minimalism as the MOAT — REJECTED by founder as an honest v1 *limitation*, not a differentiator. Never sell "we do less" as the value.

## The moat (redefined, honest)
Stack of three, none is "simple": (1) **exercisable ownership** (one-click open-format export + hosted→self-host migration — structurally impossible for cloud incumbents); (2) **credible longevity** (real business model = anti-Focalboard promise, this buyer's #1 want); (3) **effortless LIGHT self-host** (one command; no MongoDB/Elasticsearch sprawl — edge vs heavy AppFlowy/Huly). Plus brand/trust velocity + personal→team data-gravity. NOT durable individually — combination + execution speed. Watch AppFlowy going lighter.

## Requirements signals for PRD
- **v1 (in):** create/view/edit/complete/delete-with-undo (Epics 1–3 already planned); calm warm UX (Cream & Terracotta, no streaks/badges); one-command `docker compose up` self-host; **one-click export to open format (NEW v1 promise)**; safe-by-default self-host security + clear docs; responsive web from ~375px.
- **v1 (single-user):** NO auth/multi-user in first cut.
- **Fast-follow (priority order):** (1) **Import from Todoist/TickTick** — gates subscription-refugee conversion, borderline launch-blocker; (2) **hosted managed tier** (waitlist→live) — gates non-technical hero; (3) hosted↔self-host migration path; (4) PWA + offline; (5) public "what's always free" pledge; (6) trademark clearance on "Ember".
- **Phase 2:** multi-tenant hosted architecture (undesigned); **team tier** (SSO/RBAC/audit) via AD-2 seam = the revenue engine.
- **Deferred/hard:** local-first/offline CRDT sync (competitive gap vs AppFlowy, genuinely hard).
- **Say NO to (positioning discipline):** native mobile at launch, workspace/Notion features (ever), integrations/API beyond basics initially.

## Launch / GTM
- Launch **self-host-only** to technical beachhead (Segment 1 self-hosters = free, = credibility/distribution, NOT revenue). Hosted is priority fast-follow.
- Channels: self-host app stores (Coolify/CasaOS/Umbrel/Cloudron) + one prepared Show HN + r/selfhosted, leading with abandonment-insurance story.
- Gate 1 = demand test: no organic self-host installs → stop or downgrade to portfolio project (legitimate, non-embarrassing outcome).

## Unit economics
- Personal hosted ~$2–5/mo = breakeven-to-small (funnel). Team tier ~$5–10/seat/mo small teams = the margin. Self-host user COGS ≈ 0.
- If teams never form → lifestyle project, not a company. KEY UNKNOWN: own free→hosted→team conversion (only Phase 1 reveals).

## Competitive intel
- **AppFlowy:** ~70k GitHub stars, $6.4M seed (OSS Capital, Nov 2023), local-first, Notion-scale workspace — HEAVY; pre-revenue-disclosure. Main funded threat if it goes lighter.
- **Huly:** unified Linear+Notion+Slack; self-host needs MongoDB+Elasticsearch+object storage = heavy.
- **Plane:** OSS Jira/Linear alt (team PM).
- **Vikunja / Nextcloud Tasks:** light but utilitarian; CalDAV sync pain; Nextcloud Tasks feature-poor.
- **Super Productivity:** offline-first OSS personal; power-user/time-tracking lean.
- **Focalboard:** Mattermost DISCONTINUED it (Sept 2023) → the abandonment cautionary tale powering Ember's longevity moat.
- **Model proof:** Plausible $400 MRR→$3.1M ARR, 14k subs, zero VC, AGPL CE + managed hosting; Cal.com $5.1M ARR but "competed with itself" → open-core-line cautionary tale; Ghost $9/mo hosting funds core; PikaPods/InstaPods $2–4/mo = proof Segment 2 pays for convenience.

## Open questions / unknowns (from Internal FAQ)
- **[CRACK — resolve first]** Founder's true objective: income vs independence vs craft? Governs Phase-3 aggression and whether to push past Gate 1.
- Own free→hosted→team conversion rate — unmeasured.
- Multi-tenant hosted architecture — undesigned (Phase 2, acceptable).
- Distribution/community stamina — the real execution risk; "why you" weakest here.
- Open-core free/paid boundary — must be set precisely (Cal.com failure mode); publish "what's always free" pledge.
- "Ember" name: Ember.js collision — trademark clearance + SEO risk before branding spend.

## Verdict actionables
- Forged: abandonment-insurance answer; testable "own" claim; the sharpened wedge; de-risked model.
- Needs heat: import tooling; hosted-tier timing/conversion; "what's always free" pledge; distribution depth beyond first 100.
- Cracks: no single durable moat (execution-dependent); founder objective unstated; community stamina unproven.
