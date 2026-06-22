# CLAUDE.md

@AGENTS.md

The canonical guide is **`AGENTS.md`** (imported above) — read it first. This file adds only
Claude-Code-specific notes; it never duplicates AGENTS.md.

## Skills (in `.claude/skills/`)

- **`implement-plan-step`** — invoke when picking up a numbered `PLAN.md` step.
- **`seam-discipline`** — invoke when touching the Mac/LLM, lexicon, DB, validation, or STT.
- **`stack-conventions`** — invoke when writing/reviewing app, UI, or `lib/` code.

## Close-out (per phase — PLAN.md §3.5)

- Run **`/code-review`** on the phase diff; add **`/security-review`** when the change touched the
  server proxy, networking, storage, or audio capture.
- Update `AGENTS.md` (especially the _Current phase / next step_ pointer); update this file only
  if Claude-specific guidance changed.

## Verify

Run `pnpm verify` (typecheck + lint + format:check). It gains `pnpm test` + `pnpm test:e2e` once
the harness lands in Phase 0.8.

## Permissions

`.claude/settings.json` pre-approves `pnpm …` commands so they don't prompt.

## Commit policy

Commit only when the user explicitly asks. End commit messages with the required `Co-Authored-By:`
trailer.

## Memory

Durable project facts live in the user's auto-memory (`lang-tutor-project`, `user-naim`).
Progress / phase state lives in `AGENTS.md`, not in memory.
