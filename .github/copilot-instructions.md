# Copilot instructions for Lang-Tutor

Read `AGENTS.md` first. Treat it as the canonical operating guide for architecture, rules, and workflow.

Then read `CLAUDE.md` for skill-routing and close-out expectations.

## Skills in this repository

Project skills live under `.claude/skills/`. Prefer invoking the matching skill before implementing work:

- `ask-matt` when unsure which skill to use
- `grill-with-docs`, `to-prd`, `to-issues`, `implement`, `tdd` for delivery flow
- `diagnosing-bugs`, `resolving-merge-conflicts`, `triage` for maintenance flows
- `seam-discipline`, `stack-conventions` whenever touching seams or app/lib/ui code
- `handoff` when preparing a context handoff for the next session

## Non-negotiables

- Follow the hard rules in `AGENTS.md` (especially no client-to-Mac calls, seam interface discipline, and Zod parsing of external outputs).
- Keep changes surgical and aligned with existing project patterns.
- Run `pnpm verify` after code changes; run `pnpm test:e2e` when relevant.
