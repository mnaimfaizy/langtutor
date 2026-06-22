---
name: implement-plan-step
description: Use when picking up a numbered build step from PLAN.md (e.g. "implement step 1.5" or "do the next phase step"). Defines the tests-first → implement → verify → close-out workflow and the per-step Definition of Done.
---

# Implement a PLAN.md step

`PLAN.md` (repo root) is the source of truth for the roadmap. Each step is written as
**Build · Accept · Verify · Dep**. Work one step at a time.

## Workflow

1. **Read the step.** Re-read its Build/Accept/Verify/Dep in PLAN.md §6. Confirm every `Dep`
   step is already done. If a dep is missing, stop and surface it — don't build out of order.
2. **Restate the contract.** Before coding, state what "done" means in terms of the step's
   **Accept** criteria. That list is the spec.
3. **Tests-first for pure logic.** If the step touches side-effect-free logic (FSRS, CEFR gate,
   WER, validators, gamification, weakness model, Zod schemas), write the Vitest cases from the
   Accept criteria _before_ implementing. UI/glue steps verify via Playwright or a manual checklist.
4. **Implement** behind the right seam (see the `seam-discipline` skill) and per the
   `stack-conventions` skill. Keep pure logic in `lib/` as side-effect-free functions.
5. **Verify.** Run `pnpm verify` (typecheck + lint + format) and the step's named test
   (`pnpm test` / `pnpm test:e2e`) or tick its manual checklist. A step is **not done** until its
   Accept criteria pass, its Verify passes, and no existing suite regresses (Definition of Done, §3.3).
6. **Report** what you built, the Accept-criteria status, and how you verified — with evidence
   (test output / build result), not claims.

## At a phase boundary (last step of a phase)

Run the **per-phase close-out** (PLAN.md §3.5) — it is part of the Definition of Done:

1. All phase steps pass; full Vitest + Playwright suites green.
2. `/code-review` the phase diff (+ `/security-review` if it touched the proxy, network, storage, or audio capture).
3. Update `AGENTS.md` (commands, conventions, seams, data-model changes, and the **Current phase / next step** pointer).
4. Update `CLAUDE.md` only if Claude-specific guidance changed.
5. Add/Update a skill in `.claude/skills/` if the phase established a new recurring pattern.
6. Update `PLAN.md` if reality diverged — keep §1 locked decisions honest.

## Hard rules

- Never weaken `Accept` criteria to make a step pass. If a criterion is wrong, flag it and update PLAN.md deliberately.
- Don't start a step whose `Dep` isn't met.
- Commit only when the user asks.
