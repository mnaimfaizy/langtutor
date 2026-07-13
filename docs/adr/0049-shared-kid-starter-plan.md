# ADR 0049: Shared kid starter plan; AI expands only after

## Status: Accepted

## Context

ADR 0048 requires a pre-filled starter so first login is never blocked, with admin
approving templates rather than every fill. A remaining risk: if each **new
account** waits on **per-user AI plan generation** plus **admin approval**, the
path sticks whenever the Mac or admin is unavailable.

Pedagogically, the current four pre-A1 units (Alphabet → Phonics → Picture words
→ Listen & tap) are the right *skill families*, but the jump after Alphabet into
phonics/word work is too steep for kindergarten beginners (“Kennedy” / KG kids)
who do not yet know those words/sounds.

## Decision

1. **Shared starter for all kids:** ship a **product-authored, human-approved
   startup plan** that every kid-mode (pre-A1) learner gets on login — the same
   blueprint-backed plan, not a fresh AI plan per new account.
2. **Day one never depends on AI or admin:** first-session visibility and the
   ability to start come only from that shared starter. No “generate + wait for
   approval” gate on account creation.
3. **AI generates later:** after the learner is underway on the starter (exact
   trigger TBD), the AI may propose **additional** pre-A1 plans/units oriented by
   the spine; those expansions use the admin-template gate (ADR 0048), not the
   day-one path.
4. **Better ramp inside pre-A1:** keep the four skill families as the chapter’s
   north star, but **redesign the startup sequence** so Alphabet (and early
   literacy) is gentler and does not leap straight into phonics/word demands KG
   learners cannot yet handle. Exact unit count and sub-steps are a follow-on
   design choice.

## Consequences

- Starter content lives as shared assets / seeding data (or equivalent), not as
  per-profile LLM output.
- Teacher planner must not be required to unlock the first kid pre-A1 units.
- Phonics and later skill families still belong in pre-A1, but later in a gentler
  ladder (or as multi-unit stages) after a stronger alphabet/basics runway.
- Adult `enablePreA1` may reuse the same starter spine (ADR 0046); kid mode is
  the primary consumer of the shared plan.
