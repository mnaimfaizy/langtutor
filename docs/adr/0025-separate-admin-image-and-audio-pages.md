# ADR 0025: Separate admin pages for image and audio media

## Status: Accepted

## Context

`/admin/media` today lists only `kind: "image"`. Audio assets exist in the same
`media_assets` store but have no admin review surface. Options were a tabbed
single page, separate routes, or one mixed list.

## Decision

Use **separate admin pages**:

- **`/admin/media`** — images (existing route; extended with regenerate,
  proactive generate, prompt override per prior ADRs).
- **A dedicated audio admin route** (e.g. `/admin/media/audio` or
  `/admin/audio`) — list/preview (play), approve, purge, regenerate, proactive
  generate, TTS knobs + length-cap awareness.

Cross-links between the two pages (and from the main admin nav) are required so
neither surface is orphaned.

## Consequences

- Audio list/actions are not bolted into the image-only query forever; each page
  can specialize (image thumbnails vs audio players / duration display).
- Slightly more nav surface than tabs; clearer mental model for “fix pictures”
  vs “fix speech.”
- Exact audio route path chosen at implementation; document in AGENTS/nav when
  shipped.
