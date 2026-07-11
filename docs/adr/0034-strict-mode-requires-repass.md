# ADR 0034: Strict mode requires re-pass after review

## Status: Accepted

## Context

ADR 0033 defined strict vs open progression. In a real class, review after a failed
exam prepares the student; advancement still depends on demonstrating readiness,
not merely sitting through review again.

## Decision

In **strict mode**, after a failed mastery gate:

1. The next unit stays locked.
2. The learner reviews the current unit with AI teacher guidance (report + review
   activities).
3. They must **re-take and pass the exam** before the next unit unlocks.

Review alone never clears the gate. The exam remains the proof of readiness.

(Open mode is unchanged: fail still yields a teacher report; unlock is not blocked.)

## Consequences

- Gate state machine needs statuses such as: not-taken / passed / failed-pending-
  review / ready-to-retake (exact enum left to implementation).
- Retakes must be allowed without unlocking the next unit early.
- Teacher reports should differ slightly on retake vs first attempt (motivation +
  what improved / still weak) — prompt detail, not a separate product mode.
