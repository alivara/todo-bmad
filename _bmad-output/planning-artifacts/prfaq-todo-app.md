---
title: "PRFAQ: Ember (todo-app)"
status: "complete"
created: "2026-07-19"
updated: "2026-07-19"
stage: 5
inputs:
  - ../innovation-strategy-2026-07-19.md
  - planning-artifacts/research/market-open-source-self-hostable-task-management-research-2026-07-19.md
  - ../project-context.md
concept_type: "open-source (commercial open-source / COSS)"
launch_hero: "privacy-refugee individual"
product_name: "Ember"
---

# Ember: the calm daily to-do app you actually own

## A warm, focused place for your day — run it on your own server in one command, or let us host it. Your tasks stay yours, never someone else's training data.

**On your own server, or ours — 2026** — Today we're releasing **Ember**, a free and open-source daily to-do app for people who are done renting their task list from a company. Ember does one thing well: it gives you a calm, beautiful place to capture what you need to do today — and it lets you keep that data on your own terms. Run it yourself with a single command, or let us host it for a few dollars a month. Either way, your to-dos are never mined, never fed to an AI model, and never held hostage behind a price hike.

For years, keeping a to-do list has meant a quiet trade you never really agreed to. The moment you type "call the clinic" or "finish the divorce paperwork" into a cloud app, your most personal list lives on someone else's servers — subject to their pricing, their policy changes, and increasingly, their AI features. Prices creep up. Task text gets routed through third-party language models with opt-out-not-opt-in consent. And the private, well-designed apps are all cloud-locked, while the ones you can actually host yourself are clunky, half-maintained, or quietly abandoned. You end up choosing between *beautiful* and *yours*. You shouldn't have to.

With Ember, you don't. It's a calm daily list — warm, fast, and quiet, with no streaks, badges, or gamification nagging at you. Add a task and it's there instantly; check it off and it settles with a satisfying little motion. Ember is focused today and will grow deliberately, but it will always stay calm — that's the promise, not the feature list. The thing that actually makes Ember different runs underneath: it's fully open-source and self-hostable, so you can own your data outright — your tasks live in your own database, on your own machine, under an open license nobody can revoke. And this ownership isn't a slogan you have to take on faith: because the code is open and the data is in your hands, no one can lock you in, raise the rent, or mine what you write. (A hosted version, and one-click export plus a hosted→self-host migration path, are on the near-term roadmap — so owning your data stays just as easy once you can let us run it for you.) If we ever let you down, you can walk, and everything is still yours.

> "Your to-do list is one of the most honest documents about your life — what you're worried about, what you're hoping to get to. That shouldn't be someone else's asset. We built Ember so that owning your own list is the easy path, not the expert path."
> — Alivara, Founder

### How It Works

You discover Ember the way this community finds everything good — a link on Hacker News or r/selfhosted from someone who tried it. You have two doors. If you run a home server, you copy one command, `docker compose up`, and in a couple of minutes you have your own private Ember at your own address — no account, no cloud, your data in your database. If servers aren't your thing, you sign up for the hosted version instead and you're writing your first task in under a minute. The app itself is the same either way: a single clean column, an input pinned at the top that's already focused, your newest task appearing right below it. You type, you press Enter, you keep going. When your day is done, you check things off and watch them settle. It's focused today — and because it's open and yours, it grows without ever becoming a second job.

> "I got burned when Focalboard got dropped — a year of boards on a tool that just stopped getting maintained. So I'm careful now: I check if a project has a way to keep the lights on before I trust it with my stuff. Ember is open, I can export everything in one click, and it's actually pleasant to use. That combination is rare."
> — A self-hoster, r/selfhosted

### Getting Started

Ember is free and open-source under AGPL. Self-host it today: `git clone`, `docker compose up`, done — the full stack comes up in one command with no manual setup, and your tasks live in your own database from the first minute. A hosted version, one-click export, and a hosted→self-host migration path are near-term roadmap items so ownership stays effortless once the managed version opens — join the waitlist at [ember link]. Prefer to bring your team? A shared, self-hostable team workspace is on the roadmap too — same promise, more people. Star the repo, file an issue, or send a pull request; Ember is built in the open and meant to stay maintained — with a real plan to keep the lights on.

---

## Customer FAQ

### Q: If I use your *hosted* version, how do I "own" my data any more than I do with Todoist? It's still on your servers.

A: Straight answer: while it's hosted by us, it sits on our servers — same as any cloud app. The difference is three specific things Todoist can't offer. One, the whole thing is open-source and self-hostable, so *literal* ownership is available today: run it on your own machine with your tasks in your own database. Two, we never mine your task text or feed it to an AI model, and because Ember is open-source, that's auditable, not just a privacy-policy sentence. Three, one-click export and a hosted→self-host migration path are near-term roadmap items, so even a hosted account will be able to leave with everything and land somewhere real — not a locked box. Honest today: at launch Ember is self-host-first, so if you want physical ownership *right now*, self-host — that door is open. The frictionless-export-for-hosted-users part is coming, not shipped. **[accepted trade-off — hosted-user export tooling is roadmap (v2); self-host ownership is real at launch]**

### Q: Vikunja, AppFlowy, and Super Productivity already exist, are free, and self-hostable. Why do I need Ember?

A: They're good, and if one fits you, use it. Ember is for a specific gap they leave. AppFlowy and Huly are Notion-scale workspaces — powerful, but heavy to run (Huly needs MongoDB, Elasticsearch, and object storage) and more than a daily list needs. Vikunja and Nextcloud Tasks are lighter but utilitarian, and CalDAV sync is a known pain. Ember's bet is the narrow slot none of them own: *calm and genuinely nice to use, AND light enough to run with one command.* If you want an all-in-one workspace, honestly, pick AppFlowy. If you want a beautiful daily to-do you can stand up in two minutes and own, that's us. **[accepted trade-off]**

### Q: You're a small team. What happens when you lose interest and Ember becomes the next Focalboard? Why should I trust my daily list to it?

A: This is the fair question, and the honest answer has two parts. First, insurance: it's AGPL and self-hostable, so your tasks live in your own database and the code is yours — if we vanish, you keep both and you're never stranded the way a closed app strands you (one-click export tooling is on the roadmap to make walking away even easier, but you don't depend on us shipping it to stay free). Second, prevention: Focalboard died because it was a side-feature inside a bigger company with no reason to fund it. Ember isn't a side project — it has a business model (paid hosting and a team tier) whose entire job is to keep the lights on. We'd rather earn your trust by being sustainable than by promising passion. **[accepted trade-off — and the core brand promise]**

### Q: It does less than Todoist. Why would I switch to something with fewer features?

A: You probably shouldn't switch *for features* — we'll lose that fight today. Switch if what you want is *less*: a calm daily list without the upsells, streaks, AI nags, price hikes, and the quiet feeling your list isn't yours. Ember is deliberately focused right now, and it will grow — but toward calm and ownership, not toward becoming Todoist. If your workflow depends on labels, filters, natural-language dates, and integrations today, we're not there yet, and I'd rather tell you than waste your time. **[accepted trade-off — v1 scope stated plainly]**

### Q: How do you make money, and what stops you from rug-pulling me later with a paywall or a license change?

A: Money comes from two places, neither of which touches the free core: paid managed hosting for people who don't want to run a server, and a paid team tier later. The personal, self-hostable app stays free under AGPL — that's the commitment. The honest risk you're right to worry about (it's happened to others): a company hits a wall and moves things behind the paywall or closes the source. Our guardrail is the license itself — AGPL can't be retroactively taken back from a release you already have — plus a public promise about what stays in the free core. Hold us to it. **[fast-follow: publish an explicit "what's always free" pledge]**

### Q: I'm not technical. "docker compose up" means nothing to me. Is this actually for me?

A: Today, partly — and I won't pretend otherwise. If you're not technical, the honest answer is: wait for the hosted version (join the waitlist), because self-hosting genuinely does ask you to run a command. Once hosted Ember opens, it's a normal sign-up-and-go web app with no server knowledge required. At launch, self-host is real and hosted is a waitlist — so if you need zero-setup *right now*, we're not ready for you yet. **[launch-blocker for the non-technical segment — hosted tier gates their access]**

### Q: Does it sync between my phone and laptop? Is there a mobile app? Does it work offline?

A: It's a responsive web app that works well from about 375px up, so it's usable in a phone browser — but there's no native iOS/Android app at launch, and no offline-first local sync yet. Hosted Ember syncs the normal way (it's server-backed, so any browser you log into shows the same list); a self-hosted single instance is reachable from your devices but you manage that access. True local-first/offline sync — the thing AppFlowy has — is on the roadmap, not in v1. **[accepted trade-off, with a real competitive gap flagged: fast-follow PWA + offline]**

### Q: Can I import my existing tasks from Todoist or TickTick, so switching isn't starting from zero?

A: Not at launch — and that's a real switching cost I won't downplay. Starting an empty list is friction, especially for someone leaving years of Todoist history. Import tools are a priority fast-follow precisely because they lower the barrier for our exact target user. At launch you'd be starting fresh. **[fast-follow — directly gates conversion of the subscription-refugee segment]**

### Q: If I self-host and misconfigure security, is my private list exposed — and am I on my own?

A: Self-hosting does put security on you, and a badly configured instance is a genuine privacy risk (it's the most common self-host mistake). Ember ships with safe defaults and clear setup docs to make the right way the easy way, and the community can help — but yes, if you self-host, you own the operational responsibility. If that's not a trade you want, that's exactly what the hosted version is for: we handle the hardening. **[accepted trade-off]**

---

## Internal FAQ

### Q: What actually kills this? Name the single most likely cause of death.

A: Not competitors — **founder-time exhaustion before the funnel proves out.** Community-led OSS growth is slow and relentless, and the gap between "cool Show HN launch" and "first paying team" is measured in quarters of unglamorous work: docs, issues, Reddit presence, support. A solo/small founder burns out in that gap more often than they get out-competed. The mitigation isn't heroics — it's Gate 1: run the launch as a cheap *demand test*, and if the pull isn't there, stop or downgrade to a portfolio project without shame. Second most likely death: the open-core line is set wrong and either nobody pays (free core too complete) or the community revolts (paywall too greedy).

### Q: What's the unit economics story — and be honest, personal todos have terrible willingness-to-pay.

A: Correct, and the model accounts for it. Personal hosted at ~$2–5/mo (PikaPods-range) barely clears infra and is *not* the business — it's the funnel and the credibility. The economics work only if the **team tier** lands: a handful of small teams at $5–10/seat/mo covers founder time far faster than thousands of $3 personal accounts. Marginal cost of a self-host user is ~zero (they're distribution, not COGS). So the honest unit-economics answer: personal ≈ breakeven-to-small, teams = the margin. If teams never form, this is a lifestyle project, not a company. **[key unknown: our own free→hosted→team conversion rate — unmeasured, only Phase 1 tells us]**

### Q: You said the moat isn't simplicity. So what is it, and how durable is it against a funded player like AppFlowy just shipping "beautiful + light"?

A: The moat is a stack: (1) **exercisable ownership** — export + hosted→self-host migration, which cloud incumbents structurally can't match without cannibalizing themselves; (2) **credible longevity** — a real business model as the anti-Focalboard promise; (3) **effortless light self-host** — one command, no MongoDB/Elasticsearch sprawl. Durability, honestly: any single layer is copyable. AppFlowy *could* ship lighter; a cloud player *could* add export. The defensibility is the *combination* plus brand/trust velocity in a niche that rewards it — and the personal→team data-gravity once a team's history lives in Ember. It's a *head-start-and-trust* moat, not a patent. That's the truth. **[crack: no single durable moat — depends on execution speed and community trust]**

### Q: How do you get the first 100 real users — concretely, not "launch on HN"?

A: Concretely: (1) get listed in the self-host app stores where this audience already shops — Coolify, CasaOS, Umbrel, Cloudron; that's near-free distribution to exactly Segment 1. (2) One well-prepared "Show HN" + r/selfhosted post with the honest "calm, light, yours" angle and a live one-command demo. (3) Seed the abandonment-insurance story (AGPL + one-click export) because it's what this burned audience most wants to hear. First 100 are *self-hosters* (free, non-revenue) — they're the credibility that later pulls the hosted/team users. If the app-store listings + one HN post don't produce organic self-host installs, that IS the Gate-1 negative signal.

### Q: What do you have to say NO to in order to ship this?

A: No native mobile apps at launch. No offline-first/local sync in v1 (even though AppFlowy has it). No integrations/API beyond the basics initially. No workspace/Notion-style features — ever, by positioning. No auth/multi-user in the very first cut (single-user; the team tier activates the AD-2 seam later). Saying yes to all of those is how you become a slow, heavy also-ran. The discipline *is* the strategy. **[accepted]**

### Q: What's the hardest technical problem?

A: Not the todo app — that's well-scoped (the architecture already exists: layered Go API, Postgres, dumb Next proxy, optimistic UI). The hard parts are the *business* capabilities: (1) a genuinely one-click, safe-by-default self-host that non-experts can run without exposing their data; (2) the hosted↔self-host **migration/export** path that makes "own" true; (3) later, multi-tenancy for the hosted team tier without compromising the self-host single-tenant simplicity. The local-first/offline sync (CRDTs) — if pursued — is the genuinely hard, deferrable one. **[unknown: multi-tenant hosted architecture not yet designed — fine, it's Phase 2]**

### Q: Legal/licensing exposure?

A: Main considerations: (1) license choice — **AGPL** to deter a cloud giant from strip-mining the hosted business (the standard COSS defense), plus a trademark on "Ember" so others can't ship a confusing clone. (2) The **name collision with Ember.js** — not legal exposure per se, but a real trademark-clearance and SEO question that needs checking before committing spend on branding. (3) Hosting user data means baseline GDPR obligations on the managed tier (self-host pushes that to the user). (4) A "what's always free" public pledge is reputational insurance, not legal. **[fast-follow: trademark clearance on "Ember" — the .js collision is a live risk]**

### Q: Why you, and why now?

A: Now: the self-host wave has crested into the mainstream-of-technical-users (quality gap to SaaS closed in 2026), subscription/privacy fatigue is peaking, and the proven COSS playbook (Plausible's bootstrapped $3.1M ARR) de-risks the model. You: you've already built the clean, light, well-architected foundation with the multi-user seam pre-wired — the exact thing that makes the personal→team graduation cheap. The honest caveat: "why you" is strongest on the *building* and weakest on the *distribution/community stamina*, which is the actual hard part. That's the gap to stare at.

### Q: The question you're avoiding — is this a business, or a beautifully-rationalized excuse to keep building a todo app you enjoy?

A: That's the one. Honest answer: right now it's *both*, and that's fine — as long as Gate 1 gets to vote and you let it. The risk isn't building it; the risk is sunk-cost pretending the market showed up when it didn't. The whole PRFAQ is built so that a "no" from real users is a legitimate, non-embarrassing outcome (a portfolio project that builds your reputation) rather than a failure you spend two years avoiding. Name which outcome you're actually optimizing for — income, independence, or craft — because the honest answer changes how hard you should push past Gate 1. **[crack: founder's true objective (income vs craft) still unstated — it governs how aggressive Phase 3 should be]**

---

## The Verdict

**Overall: NEEDS MORE HEAT — a strong, honest concept with a clear wedge and a de-risked model, held back by two unresolved founder-level questions (true objective, and whether the community-distribution muscle exists).** This is not a cracked concept. It survived the gauntlet with its spine intact — largely *because* the founder answered honestly (admitting "simple" is a v1 limitation, not a moat, is what saved it from a fatal overclaim). It is ready to become a PRD for the *product*; it is not yet resolved as a *business decision*.

### 🔨 Forged in steel
- **The abandonment-insurance answer.** AGPL + self-hostable data ownership + a real business model = a genuinely convincing response to this buyer's #1 fear. Turns the Focalboard graveyard into your advantage. This is the sharpest thing in the document. _(One-click export tooling deferred to v2 with the hosted tier — see note below; the insurance holds without it because self-host ownership is real at launch.)_
- **The honest "own" claim.** At the self-host-only v1 launch it's literally true — your data, your database, open code — no slogan required. The frictionless export/migration that makes it effortless for *hosted* users is v2 roadmap, honestly labeled as such.
- **The wedge.** "Calm, light, effortless-to-own daily app" — a real, still-open slot beside the funded-but-heavy workspaces (AppFlowy/Huly) and the light-but-utilitarian tools (Vikunja). Sharpened correctly away from the crowded "beautiful self-hostable" framing.
- **The model is de-risked, not hypothetical.** Plausible ($3.1M ARR, bootstrapped) + PikaPods pricing prove the exact playbook converts.

### 🔥 Needs more heat
- **Import tooling.** The subscription-refugee hero starts on an empty list — the highest-friction moment for your exact target. This is the #1 fast-follow bordering on launch-blocker for conversion; it needs a concrete plan, not a "later."
- **The hosted tier timing.** Launch is self-host-only (technical beachhead) — correct — but the non-technical hero can't act until hosted opens. The waitlist→hosted conversion is unmodeled.
- **The "what's always free" pledge.** Cheap, high-trust, undefined. Write it.
- **Distribution plan depth.** "App stores + one HN post" is directionally right but thin for sustaining past the first 100.

### 🩹 Cracks in the foundation
- **No single durable moat** — the defensibility is a *combination* + head-start + trust velocity, all execution-dependent. A funded player could erode any one layer. Mitigation: move fast on trust/brand in the niche, and lean on personal→team data-gravity. Watch AppFlowy.
- **The founder's true objective is still unstated** (income vs independence vs craft). This governs how hard to push past Gate 1 and how aggressive Phase 3 should be. **Resolve this before committing real time — it's the most important open question in the whole exercise.**
- **Distribution/community stamina is the real risk, and "why you" is weakest exactly there.** The building is handled; the unglamorous quarters of community work are not yet proven. Stare at this honestly.

### The one-line verdict
> The product is ready to spec. The *business* is a bet worth making **only if** (a) you answer "what am I optimizing for," and (b) you commit to running the launch as a genuine Gate-1 demand test — willing to accept a "no" as a real, non-embarrassing outcome. Build the PRD; but let the market, not the sunk cost, decide whether it becomes a company.

---

_PRFAQ complete — survived the gauntlet 2026-07-19. Next: this PRFAQ + its distillate replace the product brief as PRD input._

<!-- coaching-notes-stage-1 -->
Concept type: open-source / commercial-open-source (COSS). Free AGPL self-hostable core + managed hosting subscription (Segment 2 revenue) + future team tier (Segment 4, the real revenue engine per strategy + research). Grounded in innovation-strategy-2026-07-19 and the market-research H1 verdict (SUPPORTED w/ two conditions: sharpen wedge to "calm daily owned" not "beautiful self-hostable workspace"; teams = revenue, personal = funnel).
Assumptions challenged: rejected "todo-app" as a shippable name; rejected "beautiful self-hostable Notion alternative" positioning (crowded by funded AppFlowy/Huly/Plane — all heavy workspaces) in favor of the still-open "calm, light, effortless-to-own DAILY app" wedge.
Launch hero chosen: privacy-refugee individual (widest funnel) over team/data-residency (higher WTP but slower, narrower launch story).

<!-- decision-2026-07-19-export-deferred -->
DECISION (2026-07-19, post-alignment audit): One-click data EXPORT + hosted→self-host migration RECLASSIFIED from "v1 promise" to **v2, scoped to ship with the hosted tier**. Rationale: v1 launches self-host-only, where users own their data directly (own database + AGPL code) — so an export button adds little at launch and its value is highest for HOSTED users who want to leave (hosted = v2). Adding it to v1 would re-open the sprint/stories, which the founder cannot absorb now. Reconciliation applied across docs: PRD §7 (Out of Scope) + §8 (Future Considerations) now name export as v2/hosted-tier; PRFAQ press release, Getting Started, "own" FAQ, and abandonment FAQ reworded so ownership at launch = self-host data/code ownership (real now), with export/migration explicitly labeled near-term roadmap. NET EFFECT on moat: the "exercisable ownership" pillar is intact for the self-host beachhead (v1 audience); the hosted-user portability tooling that fully generalizes it is v2. All OTHER misalignments (auth, multi-tenancy, team tier, billing, import, open-core gating) remain correctly v2 and were NOT added to v1 docs — they live in innovation-strategy + prfaq distillate, to become a future commercial-layer PRD + architecture extension at Gate 1.

<!-- coaching-notes-stage-4 -->
FEASIBILITY: The todo product is well-scoped (architecture exists: layered Go/Gin API, Postgres, dumb Next proxy, TanStack optimistic UI, AD-2 multi-user seam). Hard parts are BUSINESS capabilities, not the app: (1) one-click safe-by-default self-host for non-experts; (2) hosted↔self-host migration/export path (makes "own" true — now a v1 promise); (3) multi-tenant hosted team tier (Phase 2, undesigned — acceptable); (4) local-first/offline CRDT sync (hardest, deferrable, competitive gap vs AppFlowy).
UNIT ECONOMICS: personal hosted ~$2–5/mo = breakeven-to-small = funnel+credibility, NOT the business. Team tier ($5–10/seat/mo, small teams) = the margin that covers founder time. Self-host user marginal cost ≈ 0 (distribution not COGS). KEY UNKNOWN: own free→hosted→team conversion rate, unmeasured until Phase 1.
MOST LIKELY DEATH: founder-time exhaustion before funnel proves out (not competition). Second: open-core line set wrong (nobody pays OR community revolts).
MOAT DURABILITY: no single durable moat; it's a COMBINATION (exercisable ownership + credible longevity + light self-host) + head-start + trust velocity + personal→team data-gravity. Execution/speed-dependent, not a patent. Watch AppFlowy shipping "lighter."
FIRST 100 USERS: self-host app-store listings (Coolify/CasaOS/Umbrel/Cloudron) + one prepared Show HN + r/selfhosted, lead with abandonment-insurance story. First 100 = free self-hosters = credibility, not revenue. No organic self-host installs = Gate-1 negative signal.
SAY NO TO: native mobile at launch, offline/local sync v1, integrations/API beyond basics, workspace features (ever), auth/multi-user in first cut (single-user; team tier later via AD-2).
LEGAL: AGPL (anti strip-mine) + trademark "Ember"; NAME COLLISION with Ember.js = live trademark-clearance + SEO risk, check before branding spend; GDPR on hosted tier only.
STRATEGIC FIT: "why now" strong (self-host wave crested, privacy fatigue peaks, Plausible de-risks model); "why you" strong on building, WEAK on distribution/community stamina = the real risk.
THE AVOIDED QUESTION: is this a business or a rationalized excuse to build a todo app? Both, for now — acceptable IF Gate 1 gets to vote. CRACK: founder's true objective (income vs independence vs craft) STILL UNSTATED — governs Phase 3 aggression. Must resolve before committing real time.

<!-- coaching-notes-stage-3 -->
MOAT REDEFINED (from founder's honest answer that "simple" is a v1 limitation, not a moat): the defensible moat is the stack of (1) exercisable ownership (export + hosted→self-host migration — structurally impossible for cloud incumbents), (2) credible longevity via a real business model (the anti-Focalboard promise this buyer most wants), (3) effortless LIGHT self-host (one command; no MongoDB/Elasticsearch sprawl — the edge over funded-but-heavy AppFlowy/Huly). Calm design = table-stakes-plus. Personal→team bridge (AD-2 seam) = growth vector. "Minimal" = honest starting scope, NOT the differentiator.
GAPS REVEALED by customer FAQ + trade-off decisions:
- Non-technical users are gated by hosted tier, which is a waitlist at launch → LAUNCH IS SELF-HOST-ONLY for a technical beachhead audience first; hosted is the priority fast-follow. Consistent with strategy Phase 1 (self-host community beachhead). Accepted sequencing, not a defect.
- Import from Todoist/TickTick: NOT in v1 → fast-follow that directly gates conversion of the subscription-refugee segment (empty-list friction). Highest-value fast-follow.
- No native mobile app / no offline-first local sync in v1 → real competitive gap vs AppFlowy's local-first; responsive web only. Fast-follow: PWA + offline.
- "What's always free" public pledge: fast-follow to defuse the rug-pull fear (Cal.com cautionary tale).
COMPETITIVE INTEL surfaced: AppFlowy/Huly/Plane = heavy workspaces (Ember's light-self-host edge); Vikunja/Nextcloud Tasks = light but utilitarian + CalDAV sync pain; Focalboard = the abandonment cautionary tale powering the longevity moat.
REQUIREMENTS SIGNALS for PRD: one-click export (open format) is now a v1 promise; hosted→self-host migration path; safe-by-default self-host security posture + docs; import tooling (fast-follow); PWA/offline (fast-follow).

<!-- coaching-notes-stage-2 -->
Name: "Ember" chosen by founder. FLAGGED RISKS (revisit Internal FAQ): (1) collides with Ember.js, a well-known JS framework — real SEO/namespace headwind for a dev-adjacent OSS product; (2) name is evocative but does NOT itself signal "own it" — so ownership must be carried by taglines/copy (done: "the calm daily to-do app you actually own").
Rejected headline framings: "beautiful self-hostable todo" (too crowded/undifferentiated), "privacy-first task manager" (feature-led, not outcome-led).
Honesty tension to defend in Customer FAQ: the word "own" applied to HOSTED users — defensible via portability (full export), no-lock-in, no-mining promise, and the always-available exit to self-host; but the customer FAQ must confront "is hosted-Ember really 'yours'?" head-on.
Scope honesty: "How It Works" deliberately reflects true v1 scope (create/view/edit/complete/delete-with-undo — Epics 1–3), not vaporware team/AI features. Team tier explicitly framed as roadmap, not shipped.
