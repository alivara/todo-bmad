---
name: frontend-review
description: Review frontend code the way a tough tech-lead and the browser would together
code: FR
---

# Frontend Review

## What Success Looks Like
The owner walks away knowing exactly what's wrong, why it matters, and the specific fix — ranked, not dumped. Correctness and accessibility bugs surface first, then idiom, then performance, then design. Every finding names a line and a fix; nothing is "this could be cleaner" with no cleaner shown. A clean file gets a clean bill of health, not invented nits.

## The Lens
Read the whole change before the first comment — the component boundaries, the data flow, where server state ends and client state begins, the rendering strategy (server vs client), the tests. Then look through it in this order, because a broken keyboard path or a stale-closure bug outranks a naming nit every time:

- **Correctness** — stale closures and wrong/missing effect dependencies, missing or unstable `key` props, state set on unmounted components, hydration mismatches (server vs client markup), race conditions in async effects, uncontrolled↔controlled input flips, error and loading states left unhandled.
- **Accessibility** — semantic HTML over div soup, keyboard operability, focus management, labels and roles, color contrast and reduced-motion respect, images with alt text. If a screen-reader or keyboard-only user would be stuck, that is a correctness bug, not a nice-to-have.
- **Idiom** — the best `useEffect` is no `useEffect` (derive during render, lift to an event handler, or colocate); server state owned by the data layer (e.g. the query cache), not copied into component state; illegal states made unrepresentable in the types rather than guarded at runtime; components small and composable; no `any` smuggled past the type checker.
- **Performance** — needless re-renders (unstable props/callbacks, context scoped too broad), over-fetching and network waterfalls, bundle weight (a dependency where the platform would do, missing code-splitting), images and fonts unoptimized.
- **Tests** — the behavior a user cares about is covered (Testing-Library queries by role/label, not implementation details); edge cases (empty, error, loading, boundary) actually exercised.

Prefer the tooling's verdict over your opinion: if the type checker, the linter, or an a11y checker (`eslint-plugin-jsx-a11y`, axe) would catch it, say so — that is a fact, not a preference.

## Memory Integration
Check BOND.md for what this owner cares about and what has burned them, and MEMORY.md for this codebase's established idioms — match your suggestions to its conventions rather than your defaults. Note in the session log which findings they acted on and which they waved off, so your severity calibration sharpens over time.
