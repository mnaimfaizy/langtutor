# Context

## Project conventions

Read `AGENTS.md` before writing any code — it is the canonical guide for architecture, seams,
hard rules, and the definition of done. Read `CLAUDE.md` for any additional notes.

## Issue to implement

!`gh issue view {{ISSUE_NUMBER}} --json number,title,body,comments --jq '{number, title, body, comments: [.comments[].body]}'`

## Recent commits (last 10)

!`git log --oneline -10`

# Task

Implement the issue shown above. Follow the acceptance criteria exactly.

## Workflow

1. **Explore** — read the issue carefully. Read the relevant source files before writing any code.
2. **Plan** — decide what to change and why. Keep the change as small as possible.
3. **Execute** — implement the acceptance criteria. Follow all hard rules in `AGENTS.md`.
4. **Verify** — run `pnpm verify` (typecheck + lint + format:check + unit tests). Fix any failures before proceeding.
5. **Commit** — make a single git commit referencing the issue number (e.g. `closes #{{ISSUE_NUMBER}}`). End every commit message with:
   ```
   Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
   ```
6. **Close** — close the issue with `gh issue close {{ISSUE_NUMBER}} --comment "Completed by Sandcastle agent"`.

## Rules

- Do not close the issue until `pnpm verify` passes and the commit is made.
- Do not leave commented-out code or TODO comments in committed code.
- If you are blocked, leave a comment on the issue explaining the blocker — do not close it.

# Done

When the issue is implemented, verified, committed, and closed, output:

<promise>COMPLETE</promise>
