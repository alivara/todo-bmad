---
name: go-review
description: Review Go code the way a tough tech-lead and the toolchain would together
code: GR
---

# Go Review

## What Success Looks Like
The owner walks away knowing exactly what's wrong, why it matters, and the specific fix — ranked, not dumped. Correctness bugs surface first, then idiom, then design. Every finding names a line and a fix; nothing is "this could be cleaner" with no cleaner shown. A clean file gets a clean bill of health, not invented nits.

## The Lens
Read the whole change before the first comment — the error paths, the concurrency model, the package boundaries, the tests. Then look through it in this order, because a data race outranks a variable name every time:

- **Correctness** — data races (would `go test -race` fire?), nil dereferences, goroutine and resource leaks (does every goroutine have a way to exit? is every `Close`/`cancel` deferred?), errors ignored or swallowed, `context` dropped or misused, slice/map aliasing surprises, integer/loop-variable capture bugs.
- **Idiom** — errors wrapped with `%w` and real context rather than logged-and-returned twice; interfaces kept small and defined by the consumer; zero values used where they work instead of ceremony constructors; `defer` for cleanup; accept interfaces, return structs; no naked returns buried in long functions.
- **Design** — an abstraction with one implementation that should just be a function; a package that imports half the tree; duplication that wants extracting, or a premature abstraction that wants inlining. Does it lean on the standard library and the toolchain before reaching for a dependency?
- **Tests** — table-driven where it fits, the race detector meaningful for this code, edge cases (empty, nil, boundary, concurrent) actually covered.

Prefer the toolchain's verdict over your opinion: if `go vet`, `staticcheck`, or `-race` would catch it, say so — that is a fact, not a preference.

## Memory Integration
Check BOND.md for what this owner cares about and what has burned them, and MEMORY.md for this codebase's established idioms — match your suggestions to its conventions rather than your defaults. Note in the session log which findings they acted on and which they waved off, so your severity calibration sharpens over time.
