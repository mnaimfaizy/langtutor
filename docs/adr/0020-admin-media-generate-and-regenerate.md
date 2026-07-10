# ADR 0020: Admin can regenerate and proactively generate media

## Status: Accepted

## Context

`/admin/media` today is mostly a review queue for **images**. Image regenerate
already exists for rows that are already in the store. Audio has no admin view.
Generation for images only runs on a learner-facing store miss, so words covered
by the curated pack never hit the image API — admins cannot create or replace
media without that miss path.

The product need is for admins to fix bad media and fill gaps without waiting for
learners to trigger resolve.

## Decision

Admin media management supports **both**:

1. **Regenerate** — replace an existing image or audio asset for the same
   `(kind, key, style)` with a fresh generation.
2. **Proactive generate** — create media for words/phrases that do not yet have a
   store row, without requiring a learner resolve miss.

(Exact approval/visibility rules when replacing an approved or curated asset, and
UI shape for image vs audio, are decided in follow-on ADRs.)

## Consequences

- Admin actions must call the same server-only image/TTS seams as resolve routes.
- Proactive generate needs an admin entry point (word picker / free-text / curriculum
  list) that is not the learner `<img>` / audio resolve path.
- Extends ADR 0016's hybrid pack + generate model with an explicit admin control
  surface, not only passive review of pending generations.
