# ADR 0053: v1 shared starter = full four-stage skeleton; rich Alphabet only

## Status: Accepted

## Context

ADR 0050–0052 define multi-unit stages, a human-authored Alphabet runway, and AI
growth of later stages in a shared cache. Shipping scope must balance “every kid
sees a whole pre-A1 journey outline” against “only Alphabet is ready to be rich.”

## Decision

**For the first shippable shared starter:**

1. Seed a **full four-stage skeleton** (Alphabet, Phonics, Picture words, Listen
   & tap) as multi-unit outlines in the shared path — kids can see and progress
   through the chapter structure.
2. **Only the Alphabet / letters & sounds runway is richly filled** with
   product-authored activities at ship.
3. Later stages ship as **light placeholders** (reachable, completable in a thin
   form) until admin/AI grows them in the shared cache (ADR 0052).
4. Do **not** block launch on all four stages being richly playable end-to-end.

## Consequences

- Path/home UI must make “thin vs rich” stages understandable without feeling
  broken (placeholder quality bar TBD in PRD).
- Chapter exam and unlock-to-A1 behaviour must be defined against a skeleton that
  may still have thin later stages (follow-on grill).
- Admin priority after launch: enrich Phonics → Picture words → Listen & tap in
  the shared cache.
