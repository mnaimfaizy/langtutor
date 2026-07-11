# ADR 0032: Mastery gates on a fixed grammar backbone; AI teacher for feedback

## Status: Accepted

## Context

ADR 0015 delivered an LLM-teacher learning path, but the shipped behavior is mostly
completion-based unlock plus metadata fill (title / note / vocab). The intended
experience is closer to a real teacher: check understanding before advancing, then
motivate and point the learner at what to review — without turning the app into a
rigid, fully rule-defined language platform.

Two structural options were considered for post-check adaptation:

- **A** — Keep fixed backbone order; block unlock until the learner passes a gate;
  AI teacher explains results and which units need more review.
- **B/C** — Let the teacher insert, reorder, or replace path nodes based on results.

Grammar and core vocabulary are treated as long-lived curriculum assets (university-
grade grammar map; general vocab bundled, remainder retrieved gradually). Planning
voice, motivation, exams, and student reports are AI-dynamic.

## Decision

Choose **Option A**:

1. **Path order stays fixed** on the grammar backbone (and the pre-A1 tier sequence).
   Completing an activity alone does not unlock the next unit; a **mastery gate**
   (exam/check) must be passed.
2. On exam results, the **AI teacher** produces learner-facing feedback: motivation
   plus concrete pointers to which completed units/skills need more review — like a
   real teacher would.
3. **Constants (slow-changing):** grammar constructions (professional/university map)
   and a general vocabulary base. Additional vocabulary is retrieved/generated
   gradually over time.
4. **Dynamic (AI-owned):** planning register (titles/notes/motivation), exams,
   student reports, and review guidance. These must not be reduced to a static
   rule table that never changes with the learner.

This amends the *intent* of ADR 0015 (teacher adapts the experience) without
adopting structural path mutation (insert/reorder/replace backbone nodes).

## Consequences

- Unlock timing becomes mastery-gated, not merely activity-completion-gated.
- Path length/order remain deterministic and offline-friendly (backbone + buffer
  model still applies).
- New surfaces: gate/exam artifacts, teacher report after results, and a clear
  “review these units” affordance that does not rewrite the backbone sequence.
- Weakness/error data must actually reach the teacher (today’s planner weakness
  table write-path gap must be closed as part of implementation).
- Richer kid/pre-A1 content remains a separate content-depth decision; this ADR
  only locks progression authority (gate + teacher voice, not path surgery).
