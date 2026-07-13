# ADR 0055: Stage enrichment bar = admin “ready for exam” flag

## Status: Accepted

## Context

ADR 0054 requires a shared enrichment minimum before the pre-A1 chapter exam /
A1 gate. Structural rules (N units, activity shapes) are brittle while the
skeleton is still evolving; pure automation may open the gate on content that
still feels thin for KG learners.

## Decision

**Admin flag only (v1):**

1. Each later pre-A1 stage (and/or the chapter as a whole — exact UI in PRD) has
   an admin-controlled **“ready for exam”** (or equivalent) flag on the **shared**
   path cache.
2. The chapter exam is offered / A1 gate unlocks for learners only when admin has
   marked the required stages ready — not when placeholders are merely completed.
3. No automatic structural counter is required for v1 readiness (may add later as
   a helper, not the source of truth).

## Consequences

- Admin transparency: clear shared status of which stages are ready.
- One admin action unblocks the gate for **all** learners (ADR 0051).
- Risk: gate stays closed if admin never marks ready — UX must show “chapter
  still growing” rather than a silent stuck state (PRD).
- Structural heuristics remain optional future aids, not the v1 contract.
