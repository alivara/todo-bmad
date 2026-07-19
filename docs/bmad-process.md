# How BMAD Guided the Implementation — todo-app

Narrative of how the BMAD method drove this project from idea to shipped, tested app.
_TBD: expand each section with concrete artifact links and decisions._

## 1. Planning (Phase 1–2)

| Step | Artifact | Agent |
| --- | --- | --- |
| Product brief | `_bmad-output/planning-artifacts/briefs/brief-todo-app-2026-07-17/brief.md` | Analyst (Mary) |
| Market research | `_bmad-output/planning-artifacts/research/` | Analyst |
| PRD | `_bmad-output/planning-artifacts/prds/prd-todo-app-2026-07-17/prd.md` | PM (John) |
| UX design | `_bmad-output/planning-artifacts/ux-designs/` | UX (Sally) |
| Architecture spine | `_bmad-output/planning-artifacts/architecture/` | Architect (Winston) |
| Epics & stories | `_bmad-output/planning-artifacts/epics.md` | PM |

## 2. Sprint execution (Phase 3)

- Story specs → dev loop (`bmad-dev-story` / `bmad-dev-auto`) → code review → merge.
- Epic 1 (Foundation & Task Capture) ✅ · Epic 2 (Task Loop) ✅ · Epic 4 (CI/Quality Gate) ✅ · Epic 3 (Polish) in progress.
- Course correction: Epic 4 (CI/CD & Quality Gate) inserted mid-sprint via `correct-course` (2026-07-19).

## 3. Quality & retrospectives

- Retrospectives completed for Epics 1, 2, 4 (`*-retro-*.md`), with action items tracked in `sprint-status.yaml`.
- QA reports: `_bmad-output/test-artifacts/qa-reports/`.

## 4. What BMAD added

- _TBD: e.g. traceability from PRD → epics → stories → tests; risk-scored test design (R1 optimistic rollback as P0);
  the architecture spine keeping the web↔api wire contract consistent (AD-6)._
