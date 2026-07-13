# ADR 0052: Human-authored Alphabet runway first; AI grows later stages in shared cache

## Status: Accepted

## Context

ADR 0051 requires a shared path cache (admin approves once for everyone). The
shared kid starter needs a gentle Alphabet → letters & sounds runway (ADR 0050).
Filling every stage with AI before launch risks delay and over-reliance on
unreviewed generation; filling nothing with AI forever leaves Picture words /
Listen & tap thin.

## Decision

**Both (hybrid authorship):**

1. **v1 human-authored:** ship the **Alphabet / letters & sounds runway** (and
   whatever minimal shared starter scaffolding is required) as **product-authored,
   pre-approved** content — not AI-invented per signup.
2. **Later stages via shared AI + admin:** Phonics (harder), Picture words, Listen
   & tap (and further densification) may be **drafted by AI into the shared
   pending cache** and **admin-approved once** for all learners (admin-driven
   and/or background fill when the cache is thin — both allowed).
3. New users always consume the shared cache; they never wait on a private
   generate+approve loop (ADR 0049, 0051).

## Consequences

- First implementation slice prioritises spine + Alphabet runway quality.
- Admin UX needs “grow shared pre-A1 stage from spine” / pending queue (aligned
  with media proactive generate spirit, ADR 0026).
- Background fill must target **shared** pending items only, with clear admin
  transparency (list what is pending for everyone).
- Exact unit counts per stage remain for spine/PRD.
