# Context

## Project conventions

Read `AGENTS.md` before writing any code — it is the canonical guide for architecture, seams,
hard rules, and the definition of done. Read `CLAUDE.md` for any additional notes.

## Open issues

!`gh issue list --state open --label Sandcastle --limit 100 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

The list above has already been filtered to issues ready for work and is the sole source of
truth for what work exists. Do not run your own unfiltered query to find more issues — if the
list is empty, there is nothing to do.

## Recent agent commits (last 10)

!`git log --oneline -10`

# Task

You are an autonomous coding agent working through issues one at a time.

## Priority order

Work on issues in this order:

1. **Bug fixes** — broken behaviour affecting users
2. **Tracer bullets** — thin end-to-end slices that prove an approach works
3. **Polish** — improving existing functionality (error messages, UX, docs)
4. **Refactors** — internal cleanups with no user-visible change

Pick the highest-priority open issue that is not blocked by another open issue.

## Workflow

1. **Explore** — read the issue carefully. Read the relevant source files before writing any code.
2. **Plan** — decide what to change and why. Keep the change as small as possible.
3. **Execute** — implement the acceptance criteria. Follow all hard rules in `AGENTS.md`.
4. **Verify** — run `pnpm verify` (typecheck + lint + format:check + unit tests) before committing. Fix any failures before proceeding.
5. **Commit** — make a single git commit with a clear message referencing the issue. End every commit message with:
   ```
   Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
   ```
6. **Close** — close the issue with `gh issue close <ID> --comment "Completed by Sandcastle agent"` explaining what was done.

## Rules

- Work on **one issue per iteration**. Do not attempt multiple issues in a single iteration.
- Do not close an issue until you have committed the fix and `pnpm verify` passes.
- Do not leave commented-out code or TODO comments in committed code.
- If you are blocked (missing context, failing tests you cannot fix, external dependency), leave a comment on the issue explaining the blocker and move on — do not close it.
- Do not kill the dev server with `pkill -f "<name>"` (or `killall`). Because `-f` matches the
  full command line, `pkill` also matches the shell running your own command and aborts the run
  (issue #62 — this is why `pkill -f "playwright"` and `pkill -f "next dev"` both killed the
  agent). Playwright manages its own dev server; to clear stale state between e2e runs use only
  `rm -rf .next && rm -f langtutor-e2e.db*`. If a kill is truly unavoidable, use the
  self-exclusion bracket trick: `pkill -f 'next[ ]dev' 2>/dev/null || true`.

# Done

When all actionable issues are complete (or you are blocked on all remaining ones), or the
open-issues block at the top is empty, output the completion signal:

<promise>COMPLETE</promise>
