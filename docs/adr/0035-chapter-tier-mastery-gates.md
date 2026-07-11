# ADR 0035: Mastery gates at chapter/tier boundaries only

## Status: Accepted

## Context

ADR 0032–0034 introduced mastery gates and strict/open modes. Gating every unit
would make the path feel like constant testing; gating only rare CEFR jumps would
leave long stretches of unchecked “next, next, done.” The app already groups the
path into **chapters** by tier (`pre-A1`, `A1`…`C2`) via `groupUnitsByChapter`.

## Decision

Place mastery gates at **chapter/tier exits only**:

- **Inside a chapter:** units unlock by the existing completion rules (finish
  activities → unlock next unit in the same chapter).
- **Leaving a chapter:** after the chapter’s units are completed, a chapter exam
  runs. In strict mode, the first unit of the **next** chapter stays locked until
  the exam is passed (with fail → review → re-pass per ADR 0034). In open mode,
  the exam and teacher report still run, but do not block.

Chapters are the existing path tiers: `pre-A1`, then each CEFR level present on
the backbone (`A1`…`C2`).

## Consequences

- Pre-A1 → A1 is the first high-value gate (exactly the “four units then done”
  gap called out in product review).
- Chapter-complete UI (milestones) becomes the natural exam entry point.
- Within-chapter progress stays fast; assessment load is per level, not per unit.
- Fail/review scope is chapter-scoped by default (which units inside the chapter
  to review is a follow-on teacher-report decision).
- “Every unit exam” and “both light unit checks + chapter exams” are rejected for
  v1 of this design.
