# ADR 0029: Existing approved audio stays approved

## Status: Accepted

## Context

ADR 0028 makes newly generated audio `pending`. Historical TTS rows may already
be `approved` and in use by learners. Re-pending them would create a sudden
pre-A1 audio outage until admins review the whole library.

## Decision

**Leave existing approved audio rows approved.**

Only generations that occur after the gate ships start as `pending`. Admins use
the new audio page to find and fix bad clips via purge/regenerate (regenerate →
pending → re-approve per ADR 0021).

## Consequences

- No bulk migration of `approvalStatus` for audio at ship time.
- Bad historical clips remain learner-visible until manually addressed.
- Admin audio UI should make duration / playback obvious so long/bad clips are
  easy to spot without a forced re-review of the entire library.
