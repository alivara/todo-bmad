# Resolved AC Decisions — todo-app

Behavioral decisions that resolve open questions surfaced during epics/AC elicitation. Part of the contract: downstream dev, story, and test work treats these as binding. Each cites the capability / FR it binds.

| # | Binds | Decision |
|---|---|---|
| RD-1 | CAP-2 / FR6 | **Relative-time buckets.** `<60s` → "just now"; `<60m` → "Nm ago"; `<24h` → "Nh ago"; `<7d` → "Nd ago"; `≥7d` → absolute date (e.g. "Jul 10"). |
| RD-2 | CAP-7 / FR24 | **Char-counter threshold.** The counter appears within **20** of the cap (title at ≥180/200, description at ≥1980/2000) and is hidden below that. |
| RD-3 | CAP-1, CAP-3 / FR24 | **Over-cap typing.** Overflow is allowed (keystrokes are never dropped); the counter turns red/negative past the cap; submit/save is **blocked** until the field is back within cap. |
| RD-4 | CAP-5 / FR13–14 | **Multi-delete toast.** A single Undo toast shows the most recent delete; each pending delete keeps its own ~5s commit timer; Undo targets the most recent. No toast stacking. |
| RD-5 | CAP-5 / FR15 | **DELETE-commit failure (5xx).** Data-safety-first: on a failed commit `DELETE`, the row is **resurrected** into the list and the error is surfaced for retry — never silently lose a record. (`404` remains "success".) |
| RD-6 | CAP-7 / warm-dark | **First-load theme.** With no stored preference, honor the OS `prefers-color-scheme` on first load; once the user toggles, their stored choice overrides and persists. |
