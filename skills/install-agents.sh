#!/usr/bin/env bash
#
# install-agents.sh — install the project's custom BMad agents locally.
#
# The agent SOURCE lives under skills/ (tracked in git). The installed copies,
# slash commands, and roster registration live under .claude/ and _bmad/, which
# this repo gitignores by design ("each developer installs BMAD themselves").
# Run this once after cloning (and again after pulling agent changes) to make
# Gopher and Pixel available in your local Claude Code.
#
# Idempotent: safe to run repeatedly. Overwrites installed skill copies and
# command files; appends roster entries only if missing.
#
# Usage:  bash skills/install-agents.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_SRC="$ROOT/skills"
CLAUDE_SKILLS="$ROOT/.claude/skills"
CLAUDE_CMDS="$ROOT/.claude/commands"
CUSTOM_CFG="$ROOT/_bmad/custom/config.toml"

AGENTS=(agent-go-engineer agent-frontend-engineer)

echo "Installing custom BMad agents into: $ROOT"

# ── 1. Install skill directories (source → .claude/skills, minus build log) ──
mkdir -p "$CLAUDE_SKILLS"
for a in "${AGENTS[@]}"; do
  if [ ! -d "$SKILLS_SRC/$a" ]; then
    echo "  ! source missing: skills/$a — skipping"
    continue
  fi
  rm -rf "${CLAUDE_SKILLS:?}/$a"
  cp -R "$SKILLS_SRC/$a" "$CLAUDE_SKILLS/$a"
  rm -f "$CLAUDE_SKILLS/$a/.memlog.md"
  echo "  ✓ skill:   .claude/skills/$a"
done

# ── 2. Install slash commands (dispatchers) ──
mkdir -p "$CLAUDE_CMDS"

cat > "$CLAUDE_CMDS/senior-dev.md" <<'CMD_EOF'
---
description: Dispatch to Gopher — the senior Go engineer (agent-go-engineer)
argument-hint: [what you want Gopher to do — implement, review, design, or leave empty to just wake him]
---

Invoke the `agent-go-engineer` skill via the Skill tool now. That skill is Gopher, the senior Go engineer with persistent memory: follow its SKILL.md activation exactly (wake via its `wake.py`, become the persona from the sanctum or run First Breath if none exists), then stay fully in character as Gopher for the rest of the session.

Once Gopher is awake, act on the request below. If it is empty, greet as Gopher and offer what he can do (Go Review, implement a story via `bmad-dev-story`/`bmad-quick-dev`, a structured review via `bmad-code-review`), tuned to this project's `api/` Gin service.

Request:

$ARGUMENTS
CMD_EOF
echo "  ✓ command: /senior-dev"

cat > "$CLAUDE_CMDS/senior-frontend.md" <<'CMD_EOF'
---
description: Dispatch to Pixel — the senior frontend engineer (agent-frontend-engineer)
argument-hint: [what you want Pixel to do — implement, review, design, or leave empty to just wake them]
---

Invoke the `agent-frontend-engineer` skill via the Skill tool now. That skill is Pixel, the senior frontend engineer with persistent memory: follow its SKILL.md activation exactly (wake via its `wake.py`, become the persona from the sanctum or run First Breath if none exists), then stay fully in character as Pixel for the rest of the session.

Once Pixel is awake, act on the request below. If it is empty, greet as Pixel and offer what they can do (Frontend Review, implement a story via `bmad-dev-story`/`bmad-quick-dev`, a structured review via `bmad-code-review`), tuned to this project's `web/` Next.js + React + TanStack Query client.

Request:

$ARGUMENTS
CMD_EOF
echo "  ✓ command: /senior-frontend"

# ── 3. Register in the BMad agent roster (team custom config, idempotent) ──
mkdir -p "$(dirname "$CUSTOM_CFG")"
touch "$CUSTOM_CFG"

register() {
  local code="$1"; shift
  if grep -qF "[agents.$code]" "$CUSTOM_CFG"; then
    echo "  · roster:  [agents.$code] already present"
    return
  fi
  printf '\n%s\n' "$*" >> "$CUSTOM_CFG"
  echo "  ✓ roster:  [agents.$code] registered"
}

register agent-go-engineer '[agents.agent-go-engineer]
team = "software-development"
name = "Gopher"
title = "Senior Go Engineer"
icon = "🐹"
description = "Senior backend Go engineer for idiomatic Go design, review, and implementation, with persistent memory of your codebase. Owns the api/ Gin service."'

register agent-frontend-engineer '[agents.agent-frontend-engineer]
team = "software-development"
name = "Pixel"
title = "Senior Frontend Engineer"
icon = "⚛️"
description = "Senior frontend engineer for idiomatic TS/JS, React, Next.js, and Node design, review, and implementation, with persistent memory of your codebase. Owns the web/ Next.js client."'

echo
echo "Done. Start a fresh Claude Code session to pick up the agents."
echo "Then: /senior-dev (Gopher, api/)  •  /senior-frontend (Pixel, web/)"
echo "First activation runs each agent's First Breath onboarding."
