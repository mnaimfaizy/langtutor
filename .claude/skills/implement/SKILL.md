---
name: implement
description: Implement a piece of work based on a PRD or GitHub issue. Use when picking up an issue to implement test-first.
disable-model-invocation: true
---

# Implement

Implement the work described by the user in the PRD or issue.

1. Read `AGENTS.md` and the issue body carefully. Confirm what "done" means against the acceptance criteria before writing a line of code.
2. Use **`/tdd`** where possible, at pre-agreed seams. For pure logic, write the Vitest test first. For UI/integration work, verify via Playwright or a manual checklist.
3. Consult **`seam-discipline`** and **`stack-conventions`** for project-specific constraints (Hard Rules in `AGENTS.md`).
4. Run typechecking and the single relevant test file regularly as you go. Run `pnpm verify` (full suite) once at the end.
5. Once done, use **`/code-review`** to review the work, and **`/security-review`** if the change touched the proxy, networking, storage, or audio capture.
6. Commit only when the user asks. End commit messages with the required `Co-Authored-By:` trailer.
