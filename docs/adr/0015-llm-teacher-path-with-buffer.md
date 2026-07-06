# ADR 0015: LLM-teacher-planned learning path with pre-generated buffer

## Status: Accepted

## Context

The home experience is being redesigned as a **guided learning path** (ordered units
that unlock progressively) for both kid and adult experience modes (ADR 0014). The
curriculum source options were: a hand-authored static curriculum, units derived
mechanically from the 39-entry grammar map, or an LLM-planned adaptive path.

The app is offline-first; the Mac LLM is frequently unreachable (away from home,
Mac asleep). A purely LLM-driven path would break offline.

## Decision

The **LLM acts as the teacher**: it plans the path per learner — behaving like a
professional English teacher (adult mode) or a kindergarten teacher (kid mode) —
using the learner profile, level, and weakness-engine data. A static backbone
(grammar map + level milestones) anchors the plan; the LLM fills and adapts units
within it.

To survive offline: the teacher **plans several units ahead and pre-generates their
content while the Mac is reachable** (extending the existing pre-cache pattern).
When offline, the learner continues along the buffered path; planning resumes when
the Mac returns.

## Consequences

- New seam-adjacent responsibility: a path-planner that runs server-side against the
  Mac LLM, with Zod-validated plan output (hard rule 3).
- The buffer requires background pre-generation and storage of upcoming units'
  content (passages, prompts, audio, cards) in the DB.
- Path state (current unit, buffered units, completion) becomes learner data.
- If the buffer is exhausted offline, the path pauses gracefully; SRS review and
  cached content remain available.
