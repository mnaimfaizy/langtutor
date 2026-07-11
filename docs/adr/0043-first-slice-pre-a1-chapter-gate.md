# ADR 0043: First slice = Pre-A1 chapter mastery gate

## Status: Accepted

## Context

ADRs 0032–0042 define mastery gates, strict/open modes, hybrid exams, teacher
reports, review assignments, richer pre-A1 (later), and curriculum guides without
live search. Shipping all chapters + content expansion at once is too large.

## Decision

**First vertical slice:** Pre-A1 chapter gate only, on the **current four units**.

In scope for slice 1:

- Chapter exam after pre-A1 units are completed (before A1 unit 0 unlocks in strict mode)
- Hybrid exam shape for pre-A1 skills; AI-filled items; Zod validation; exam pre-buffer
- Deterministic pass (70% overall / 50% per-skill floors)
- Teacher report; on fail (strict): review assignment → re-pass required
- Progression mode: kids always strict; adults may use open
- Wire enough attempt/score data for the teacher (exam results; fix weakness feed if needed for report quality)

Explicitly **later slices**:

- Richer/more pre-A1 units (ADR 0040 content expansion)
- Chapter gates for A1…C2
- Full curated curriculum-guide corpus per tier (slice 1 may ship a **minimal pre-A1 guide** stub so prompts are grounded)

## Consequences

- Highest product pain (pre-A1 “next, next, done”) is addressed first.
- Gate framework should be designed so A1+ chapters reuse the same seams.
- Do not block slice 1 on full book-licensing research; expand guides afterward.
