# ADR 0016: Pre-A1 kid tier with generate-once, store-forever media

## Status: Accepted

## Context

The revamp adds a genuine **pre-A1 tier** for children starting from zero: alphabet,
phonics, picture-word matching, listen-and-tap games. This tier is image- and
audio-heavy, while the existing stack is text-first. Generating media on every view
is slow, costly, and breaks offline; media for core kid vocabulary is highly
reusable across users and sessions.

Image sources considered: local image model on the Mac (extra infra, variable
quality), cloud image API (cost/privacy), curated open-licensed asset pack only
(zero infra but limited coverage).

Note: Groq and Mistral — already integrated for chat/STT/embeddings — do **not**
offer image generation. NVIDIA's free NIM API (SDXL/Flux) is the leading free-tier
candidate; final provider choice needs a research spike.

## Decision

1. **Pre-A1 is a real content tier**, not a restyled A1.
2. **Media strategy is hybrid**: a curated open-licensed illustration pack covers
   the base vocabulary; an image-generation provider fills gaps for words missing
   from the pack.
3. **Generate once, store forever**: generated images and TTS audio are persisted in
   app storage keyed by word/phrase, so every later user/session reuses them instead
   of regenerating.
4. Image generation goes behind the existing provider-seam pattern (server-only,
   `app/api/*`), with the concrete provider (NVIDIA NIM free tier vs. alternatives)
   decided after a research spike.

## Consequences

- New storage concern: a media asset store (images + audio) with dedup by key,
  shared across users — needs a home in both local (SQLite/filesystem) and cloud
  (Supabase storage) modes.
- New seam or seam extension for image generation; Zod-validate/content-check
  outputs before storing (kid-safety review of generated images).
- Research task: evaluate free image-gen APIs (NVIDIA NIM first) for quality,
  rate limits, and licensing of outputs.
- Curated pack licensing must permit bundling/redistribution (CC0/CC-BY).
