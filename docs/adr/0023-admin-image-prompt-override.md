# ADR 0023: Admin image prompt override with prior prompt visible

## Status: Accepted

## Context

Image regenerate with a fixed kid-illustration template can repeatedly miss the
intended sense of a word. Admins need a way to steer a single generation without
turning `/admin/media` into a free-form art studio for arbitrary unrelated keys.

## Decision

1. **Optional prompt override (v1):** admin image regenerate and proactive
   generate default to `buildKidIllustrationPrompt(word)` (or equivalent), but
   the admin may edit the prompt for that generation.
2. **Show the prior prompt:** the admin UI must display the prompt that applies
   to the current asset (or the default template if none was stored) before the
   admin edits and regenerates.
3. Generated output still uses the same `(kind, key, style)` store key and still
   starts **pending** (ADR 0021).

Whether the effective prompt is persisted on the `media_assets` row (so overrides
survive across sessions) is a follow-on detail if not already decided.

## Consequences

- Admin image actions accept an optional `prompt` string; empty/omitted → template.
- UI needs a prompt field pre-filled from the last-known / default prompt.
- Kid-safety review remains required; override does not auto-approve.
