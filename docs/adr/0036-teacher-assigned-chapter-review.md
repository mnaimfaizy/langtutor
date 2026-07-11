# ADR 0036: Teacher-assigned chapter review after a failed gate

## Status: Accepted

## Context

After a failed chapter exam (ADR 0034–0035), the learner must review before
re-taking. Requiring every unit in the chapter is blunt; leaving review entirely
optional undercuts strict mode. The product intent is an intelligent teacher that
targets what the student actually missed.

## Decision

On chapter-exam **fail** (strict mode):

1. The AI teacher produces a **teacher report** plus a **review assignment**:
   specific units and/or skills within that chapter, chosen from exam outcomes and
   weakness data.
2. The learner must complete that assignment before the exam is offered again.
3. Re-pass of the exam is still required to unlock the next chapter (ADR 0034).

Open mode: the same report/assignment may be shown as guidance, but it does not
block progress.

Rejected for v1: forced full-chapter redo (A) and recommendation-only free revisit (C).

## Consequences

- Need a persisted review-assignment model (which units/skills, done flags) tied to
  a gate attempt.
- Teacher planner/report prompts must output structured, Zod-validated review
  targets — not only prose.
- Weakness/error data (and exam item results) must be available to the teacher;
  the existing unused `weakness` table write-path should be fixed as part of this.
- Within-chapter unit completion rules stay as today until a gate fails.
