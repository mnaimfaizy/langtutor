# ADR 0038: Deterministic exam pass/fail; AI for report only

## Status: Accepted

## Context

Chapter exams need a clear pass/fail for strict-mode unlock (ADR 0034–0035). Pure
AI judgment is hard to reproduce offline, easy to dispute, and weakens the
“curriculum constants” story. Pure score with no teacher voice undercuts the
intelligent-teacher product.

## Decision

**Hybrid scoring (Option C):**

1. **Pass/fail is deterministic** from the attempt score against a fixed threshold
   (curriculum constant; exact % and any per-section rules decided separately).
2. The **AI teacher does not override** pass/fail.
3. The AI produces the **teacher report** and (on fail, strict mode) the **review
   assignment** from the scored attempt + weakness data.

This works offline for pass/fail when the exam was pre-buffered (ADR 0037); only
the rich report may be deferred.

## Consequences

- Scoring logic is pure/local and unit-testable — no Mac call to decide unlock.
- Threshold values live with exam shape constants, not in free-form prompts.
- Teacher prompts receive the score breakdown as input; they must not be asked to
  invent a conflicting pass/fail.
- Follow-on: concrete threshold rule — see ADR 0039.
