# CLAUDE.md

@AGENTS.md

The canonical guide is **`AGENTS.md`** (imported above) — read it first. This file adds only
Claude-Code-specific notes; it never duplicates AGENTS.md.

## Skills (in `.claude/skills/`)

Not sure which to use? Invoke **`/ask-matt`** — it routes to the right skill for the situation.

| Skill                           | When to invoke                                        |
| ------------------------------- | ----------------------------------------------------- |
| `ask-matt`                      | Unsure which skill fits                               |
| `grill-with-docs`               | Sharpening a plan before coding                       |
| `domain-modeling`               | Pinning down terms or recording an ADR                |
| `prototype`                     | Answering a design question with throwaway code       |
| `codebase-design`               | Designing or reviewing a module interface             |
| `improve-codebase-architecture` | Finding and deepening shallow modules                 |
| `to-prd`                        | Turning a conversation into a PRD on GitHub           |
| `to-issues`                     | Breaking a PRD into vertical-slice GitHub issues      |
| `implement`                     | Picking up a GitHub issue to implement                |
| `tdd`                           | Building or fixing test-first                         |
| `triage`                        | Working through incoming GitHub issues                |
| `diagnosing-bugs`               | Hard bug or performance regression                    |
| `e2e-playwright`                | Creating or fixing Playwright e2e (Mac stubs, SW)     |
| `resolving-merge-conflicts`     | In-progress git merge/rebase conflict                 |
| `handoff`                       | Handing context to the next session/agent             |
| `seam-discipline`               | Touching the Mac/LLM, lexicon, DB, validation, or STT |
| `stack-conventions`             | Writing or reviewing app, UI, or `lib/` code          |

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
