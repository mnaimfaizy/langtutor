# ADR 0051: Shared pre-A1 path cache; personalize practice later

## Status: Accepted

## Context

Pre-A1 is a continuous journey and the AI teacher can propose content along the
way (ADR 0040, 0049). Generating a **new path per user** (e.g. on signup or after
every unit) forces either (a) admin approval per learner — no transparency or
capacity for that today — or (b) unreviewed per-user AI output. Both are
unacceptable for the shared kid starter model (ADR 0048–0049).

The product already uses “generate once, reuse” for media assets. Path chapter
content needs the same spirit.

## Decision

1. **Shared path cache (not per-user paths):** AI-generated (or human-authored)
   pre-A1 chapter/unit templates live in a **shared store**. Once created and
   admin-approved, they are available to **all** learners. A new signup **does
   not** generate a fresh path — they receive the current shared starter + any
   already-approved cached chapters/units.
2. **No per-user AI invoke on unit completion** for inventing the next path unit
   as the default. Progression consumes the shared ladder; we do not call the
   teacher to invent a private next unit for each learner after every completion.
3. **Admin approves into the shared cache** (one review serves everyone), not
   into a single profile.
4. **Future personalization = practice sessions, not private paths:** later, a
   learner may request **extra practice** generated from **their weaknesses**
   (session-scoped). That is additive drill, not a fork of the main pre-A1
   chapter spine for that user alone.
5. Continuous “AI thoughts along the way” means the teacher may help **fill /
   buffer content inside shared templates** and (later) weakness practice — not
   that every learner gets a unique curriculum.

## Consequences

- Need a durable shared cache/seam for path unit templates (mechanism TBD in
  PRD; same-origin, Zod, admin pending gate).
- Seeding and home path read from shared + profile progress, not from
  per-profile planned unit trees as the source of curriculum truth.
- Weakness-driven “more practice” is explicitly a **later** slice.
- Aligns with media-store reuse and ADR 0048 template approval.
- Teacher planner’s role for pre-A1 shifts toward filling shared templates /
  buffering, not per-account path invention on login.
