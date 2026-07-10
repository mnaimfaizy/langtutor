# ADR 0022: Admin TTS controls plus hard audio length cap

## Status: Accepted

## Context

Some stored TTS clips are low quality or excessively long. Admin regenerate with
identical defaults may not fix that. Learner-triggered resolve can also persist
long clips before any human review.

## Decision

1. **Admin knobs (v1):** when regenerating or proactively generating audio, the
   admin UI exposes controls such as voice, speaking rate, and/or max duration
   (exact control set to be specified in implementation against the existing TTS
   seam).
2. **Hard server-side length cap:** every TTS path (learner resolve and admin
   generate/regenerate) enforces a maximum clip length before persist. Oversized
   output is rejected or truncated per the TTS adapter’s safe behavior — it must
   not be stored as an unbounded clip.

Exact numeric cap and truncation-vs-reject behavior are implementation details
documented when wired; the product rule is: no uncapped audio in `media_assets`.

## Consequences

- TTS resolve / produce helpers gain a shared length guard (not admin-UI-only).
- Admin audio actions need a small options payload beyond word + style.
- Existing over-long rows may need purge/regenerate; migration/backfill is
  optional and out of scope unless separately decided.
