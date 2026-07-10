# ADR 0026: Proactive generate via free-text and curriculum gaps

## Status: Accepted

## Context

ADR 0020 requires proactive generate for words with no media row. Admins need a
way to choose targets without depending on learner resolve misses.

## Decision

v1 admin proactive generate supports **both**:

1. **Free-text** — admin types a word/phrase and generates on the image or audio
   admin page.
2. **Curriculum gap helper** — a list derived from known pre-A1 word sources
   (alphabet picture words, picture-match, listen-tap, and any other agreed
   kid-media word lists), filterable to entries **missing** a store row for that
   kind/style.

Each page generates only its kind (image page → images; audio page → audio).

## Consequences

- Need a shared “pre-A1 media vocabulary” enumeration (or per-activity exports)
  for the gap list — pure data, not LLM.
- Free-text must normalize like resolve (`trim` / lowercase) and reuse the same
  keys as learner URLs.
- Gap list is best-effort coverage of shipped activities; words outside those
  lists remain reachable via free-text.
