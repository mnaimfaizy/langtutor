# Context

## Environment contract

Read `.sandcastle/ENVIRONMENT.md` **first** — it lists what works in this sandbox, what is
banned (`sudo`, `apt`, `playwright install --with-deps`), the anti-thrash rule, and the e2e
policy. Do not re-verify known environment facts; trust the contract.

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
5. **E2E** — run only the Playwright specs affected by your change (plus any new specs):
   `pnpm exec playwright test tests/e2e/<spec>.spec.ts`. Follow the e2e policy in
   `.sandcastle/ENVIRONMENT.md`.
6. **Commit** — make a single git commit referencing the issue number (e.g. `closes #{{ISSUE_NUMBER}}`). End every commit message with a trailer naming the agent and model you are running as, e.g.:
   ```
   Co-Authored-By: <Agent> (<model>) <noreply@sandcastle.local>
   ```
7. **Close** — close the issue with `gh issue close {{ISSUE_NUMBER}} --comment "Completed by Sandcastle agent"`.

## Rules

- Do not close the issue until `pnpm verify` passes and the commit is made.
- Do not leave commented-out code or TODO comments in committed code.
- If you are blocked, leave a comment on the issue explaining the blocker — do not close it.
- Anti-thrash: if errors appear in files you did not touch, follow the anti-thrash rule in
  `.sandcastle/ENVIRONMENT.md` — at most one reinstall attempt, then report and stop.
- If you verify a **new** environment fact the contract doesn't cover, add it to the
  "Known issues" section of `.sandcastle/ENVIRONMENT.md` in the same commit.

# Done

When the issue is implemented, verified, committed, and closed, output:

<promise>COMPLETE</promise>
