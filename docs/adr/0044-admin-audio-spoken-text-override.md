# ADR 0044: Admin audio spoken-text override and persist

## Status: Accepted

## Context

Admin image regenerate already exposes an editable prompt (ADR 0023 / 0024). Audio
regenerate only exposed voice / rate / max-duration knobs (ADR 0022). Regenerating
with identical defaults sent the bare word to Groq Orpheus, so clips often sounded
the same. Orpheus English supports vocal directions in the speech `input`
(e.g. `[cheerful] apple`), but admins had no UI to edit that text.

Free-form descriptive prose in `input` is spoken aloud. Only bracketed 1–2 word
tags steer delivery without being spoken (Groq Orpheus docs).

## Decision

1. **Say + Direction (v1):** admin audio regenerate and proactive generate expose:
   - **Say** — exact words Orpheus should speak (usually the vocabulary word).
   - **Direction** — optional short vocal tag (without requiring the admin to type
     brackets). The app composes `[direction] say` before calling Groq.
2. **Show the prior parts:** regenerate pre-fills by parsing the last stored
   `prompt` into say + direction, or the word when missing.
3. **Persist for generated audio:** write the exact composed text sent to the TTS
   provider onto `media_assets.prompt` for `source: "generated"` audio rows (same
   column as images; curated-pack remains null).

## Consequences

- `produceWordAudio` / admin options accept composed `prompt`; learner resolve
  without an override still speaks the word and stores that word as `prompt`.
- Existing audio rows with `prompt: null` fall back to the word until regenerated.
- Admins must not put full sentences in Direction — that would be spoken if
  mistakenly placed in Say; Direction is normalized into a single `[tag]`.
