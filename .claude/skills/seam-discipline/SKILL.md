---
name: seam-discipline
description: Use when adding or changing any code that talks to the Mac (LLM / Whisper), the lexicon, the database, content validation, or transcription — i.e. anything touching a seam. Enforces interface-only imports, registry wiring, the no-client→Mac rule, and Zod-parsing every model output.
---

# Seam discipline

The whole "move to the cloud later = a config change, not a rewrite" promise depends on this.
Feature code depends on **interfaces**, never on concrete providers.

## The five seams (PLAN.md §2.3)

| Seam                | Responsibility                                                  |
| ------------------- | --------------------------------------------------------------- |
| `LLMClient`         | `chat(messages, {schema?, stream?})`, `embed(texts)`            |
| `LexiconProvider`   | `define`, `relations`, `cefrLevel`, `audio`                     |
| `ContentRepository` | CRUD for profile / cards / content / errorEvents / gamification |
| `Transcriber`       | `transcribe(audio) → text` (speech phases)                      |
| `ContentValidator`  | `validate(text, targetCefr) → {ok, violations}`                 |

## Rules (non-negotiable)

1. **Import the interface, never the concrete.** Feature code imports the seam type from
   `lib/<seam>`. Concrete implementations are constructed and wired in the single composition
   root `lib/registry.ts`. If you're importing a Dexie class, an Ollama client, or a `fetch` to
   the Mac from inside a feature / route / component, you're doing it wrong.
2. **No client → Mac calls, ever.** The browser only makes **same-origin** requests. The Mac
   (Ollama / whisper-server) is reached _only_ from server route handlers under `app/api/*`
   (`app/api/llm`, `app/api/stt`). This avoids mixed-content / CORS and keeps the endpoint/key
   server-side. A `fetch` to a LAN IP or Tailscale host from a client component is a bug.
3. **Zod-parse every LLM / agent / external output before use.** No model output, dictionary-API
   response, or agent result enters the app un-validated. Parse with a Zod schema at the boundary;
   on failure, run the corrective retry (pipeline §2.4) — don't trust-and-pray.
4. **Cache what the Mac produces.** Validated generated content / lookups are written to
   IndexedDB via `ContentRepository` so they're offline-available thereafter (PLAN.md §2.2).
5. **Secrets are server-only.** Mac base URLs / model names live in `.env.local` (server) or
   `profile.settings` (runtime override) — never bundled into client code.

## When adding a new provider

Implement the existing interface and wire it in `registry.ts`. Do not change call sites.
