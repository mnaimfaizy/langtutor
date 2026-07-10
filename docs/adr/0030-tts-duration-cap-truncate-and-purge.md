# ADR 0030: TTS max duration 5s with truncate; admin may purge

## Status: Accepted

## Context

ADR 0022 requires a hard server-side length cap. Input is already limited to 200
characters for Groq TTS, but output duration can still be excessive. Admins also
need a way to remove irreparably bad clips entirely.

## Decision

1. **Cap:** maximum stored media-asset audio duration is **~5 seconds**.
2. **Over-cap behavior:** **truncate** the clip to the cap, then persist (still
   subject to the pending gate for new generations — ADR 0028).
3. **Admin delete:** admin can **purge/delete** an audio asset completely from
   the store when it is not acceptable (same idea as image purge). Truncate does
   not remove the need for purge when quality is wrong.

## Consequences

- Shared post-synthesize (or equivalent) duration check + WAV/audio trim before
  `putMediaAsset`.
- Admin audio page must expose purge for pending and approved rows.
- After purge, learner resolve may miss and auto-generate a new **pending** clip
  (ADR 0027) unless admin regenerates deliberately.
