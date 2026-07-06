# ADR 0013: Content pipeline deepening — ContentSink seam and skipValidation

## Status: Accepted

## Context

Two architectural friction points were identified in a review of the content generation pipeline:

1. `generateContent()` accepted a `ContentRepository` dependency but only ever called
   `putContent()` on it. Server route handlers therefore had to instantiate a 102-line
   `NullContentRepository` no-op — a shallow 30-method adapter that failed the deletion test
   and obscured what the pipeline actually persists.

2. `NullContentValidator` was a hypothetical seam (only one implementation, never varied across
   call sites) used solely to bypass CEFR validation for teacher-voice content (writing prompts).
   Its existence implied a seam where none was needed, and its wiring was scattered in route
   handlers rather than expressed at the design level.

## Decision

**ContentSink (`lib/db/content-repository.ts`):** A one-method interface
`{ putContent(content: NewContent): Promise<number> }`. `ContentRepository extends ContentSink`,
so all existing implementations satisfy it without changes. `generateContent()` now accepts
`ContentSink` as its fourth parameter.

**Named interface over `Pick`:** `Pick<ContentRepository, 'putContent'>` would work but lacks a
name. A named interface is documentable, importable by tests, and extendable (e.g. if the pipeline
later needs a `getContent()` for de-duplication, `ContentSink` is the right place to add it).

**`skipValidation?: boolean` on `GenerateOptions`:** When `true`, the pipeline bypasses the
validate → corrective-retry loop and treats the first LLM response as immediately valid. The
validator parameter is typed `ContentValidator | null`; passing `null` with `skipValidation: true`
is the intended pattern for teacher-voice content.

**`NullContentValidator` deleted:** It was a hypothetical seam (one adapter). The intent "do not
validate" is now expressed directly as `skipValidation: true` in `GenerateOptions` — explicit at
the design level, not hidden in a class name.

**`NullContentRepository` deleted → `NoopContentSink`:** Replaced with a 3-line
`NoopContentSink implements ContentSink` in `lib/content/null-adapters.ts`.

**`lib/content/server.ts` (new composition root):** The `LocalContentValidator` singleton
(previously a module-level `_validator` inside the reading route handler) now lives here as
`getContentValidator()`. Mirrors the `lib/llm/server.ts` pattern — one composition root per
seam, one place to swap the concrete.

## Consequences

- `generateContent()` interface shrinks from 30-method `ContentRepository` to 1-method
  `ContentSink` — depth increases, caller burden decreases.
- `NullContentRepository` (102 lines) and `NullContentValidator` (8 lines) deleted.
- `ContentValidator` seam is now fully respected: concrete wired only in `lib/content/server.ts`,
  never in route handlers.
- The `skipValidation` open roadmap item in `docs/decisions.md` is resolved.
