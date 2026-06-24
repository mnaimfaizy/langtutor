# CLAUDE.md

@AGENTS.md

The canonical guide is **`AGENTS.md`** (imported above) — read it first. This file adds only
Claude-Code-specific notes; it never duplicates AGENTS.md.

## Skills (in `.claude/skills/`)

- **`tdd`** — invoke when building a feature or fixing a bug test-first.
- **`grill-with-docs`** — invoke to sharpen a plan before writing code.
- **`to-prd`** — invoke to turn a conversation into a PRD on GitHub issues.
- **`to-issues`** — invoke to break a PRD into vertical-slice GitHub issues.
- **`seam-discipline`** — invoke when touching the Mac/LLM, lexicon, DB, validation, or STT.
- **`stack-conventions`** — invoke when writing/reviewing app, UI, or `lib/` code.

## Close-out (per feature)

- Run **`/code-review`** on the diff; add **`/security-review`** when the change touched the
  server proxy, networking, storage, or audio capture.
- Update `AGENTS.md` if commands, seams, or the repo layout changed.
- Update this file only if Claude-specific guidance changed.

## Verify

Run `pnpm verify` (typecheck + lint + format:check + unit tests).
Run `pnpm test:e2e` separately for Playwright e2e (auto-starts the dev server).

## Permissions

`.claude/settings.json` pre-approves `pnpm …` commands so they don't prompt.

## Commit policy

Commit only when the user explicitly asks. End commit messages with the required `Co-Authored-By:`
trailer.

## Memory

Durable project facts live in the user's auto-memory (`lang-tutor-project`, `user-naim`).
Current state lives in `AGENTS.md`.
