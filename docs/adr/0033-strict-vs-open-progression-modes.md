# ADR 0033: Strict vs open progression modes for mastery gates

## Status: Accepted

## Context

ADR 0032 fixed the grammar backbone and introduced mastery gates with AI teacher
reports. A real classroom does not advance a student who failed the class exam into
a harder next class; they review that class first. Some learners (and some product
contexts) still want today’s freer “keep going” feel, while still receiving teacher
feedback.

## Decision

Ship **two progression modes** (refined by ADR 0034–0036, 0042):

1. **Strict mode (default)** — Chapter mastery gates must be passed to unlock the
   next chapter. On fail: teacher report + teacher-assigned review within the
   chapter; learner must re-pass the exam before advancing.
2. **Open mode** — Path unlock behaves like today (unit completion can advance).
   Chapter exams still run; on fail the AI teacher still produces a report, but
   the gate **does not block** forward progress.

**Who can use open:** adults may choose open in Settings; **kids are always
strict** (ADR 0042).

## Consequences

- Profile/settings gains a progression-mode field for adult accounts.
- Gate UI and unlock state machine must branch on mode; teacher-report generation
  is shared by both modes.
- Open mode must not skip generating exams/reports — only the block is optional.
