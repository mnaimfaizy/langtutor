# ADR 0027: Keep learner resolve auto-generate on miss

## Status: Accepted

## Context

With a full curated illustration pack, learner image resolve rarely misses, so the
image API may never run unless admin regenerates. ADR 0020 adds admin proactive
generate, which raised whether learner resolve should stop calling providers.

## Decision

**Keep auto-generate on miss** for both:

- `GET /api/image/resolve`
- `GET /api/audio/resolve`

On miss, the server still produces via the image/TTS seam, persists as
**pending** (existing kid-safety gate), and returns unavailable to the learner
until admin approval. Admin regenerate / proactive generate (ADRs 0020–0026)
are additive control surfaces, not a replacement for resolve-side generation.

## Consequences

- Pending queues can still grow from learner traffic on uncovered words.
- Pack-covered words still need admin **regenerate** (or purge + miss) to hit
  the image API — proactive generate does not apply when a row already exists;
  use regenerate instead.
- Provider keys remain required for miss paths in environments that exercise
  uncovered vocabulary.
