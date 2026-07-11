# ADR 0039: Chapter exam pass = overall threshold + per-skill floors

## Status: Accepted

## Context

ADR 0038 made pass/fail deterministic. An overall-only score allows gaming a chapter
exam by dominating one skill while failing another — weak for a level-exit gate.

## Decision

A chapter exam **passes** only when both hold:

1. **Overall score** ≥ the chapter’s overall threshold.
2. **Every skill section** scored in the exam is ≥ that chapter’s per-skill floor.

**v1 curriculum defaults** (tunable constants beside exam shape, not prompt magic):

- Overall threshold: **70%**
- Per-skill floor: **50%**

Tiers may override these later via exam-shape config; defaults apply until then.

## Consequences

- Score breakdown must be per skill section, not a single blob.
- Teacher report on fail should highlight which sections broke the floor vs overall.
- Review assignments (ADR 0036) should prefer units/skills tied to failed sections.
