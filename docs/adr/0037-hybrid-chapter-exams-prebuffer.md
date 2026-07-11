# ADR 0037: Hybrid chapter exams with offline pre-buffer

## Status: Accepted

## Context

Chapter mastery gates (ADR 0035) need exam content. Fully AI-generated exams break
when the Mac/provider is unreachable; a fully curated bank undercuts the “intelligent
teacher” intent. The path already pre-buffers upcoming unit content (ADR 0015);
exams should follow the same offline contract.

## Decision

1. **Hybrid exam construction:** a fixed exam **shape** per chapter/tier (skills
   checklist, item counts, pass structure) is curriculum-constant; the AI **fills
   items** (questions/prompts/options) per attempt from that chapter’s grammar/vocab
   and weakness context. Output is Zod-validated.
2. **Offline strategy = pre-buffer (Option A):** while the provider is reachable,
   replenishment also prepares the **next chapter exam** (filled items ready to
   play). The learner can take a buffered exam offline.
3. **Teacher report when offline:** if a full AI report cannot be generated at
   submit time, show a minimal local score summary and queue a rich teacher report
   (+ review assignment in strict mode) for when the provider returns — do not
   invent an unbounded free-form report client-side.

Rejected for v1: pause-only gates with no buffered exam (B) as the primary offline
path; curated-only exams with AI only for reports (C) as the primary online path
(curated shape remains; items are AI-filled when buffered).

## Consequences

- Extend path replenishment to include “next gate exam buffered” alongside unit
  buffer depth.
- If the buffer is empty and the provider is down at chapter exit: graceful pause
  (same spirit as `isPathPaused`) — especially in strict mode.
- Retakes may need a freshly filled attempt when online; offline retake can reuse
  or rotate among buffered variants (implementation detail).
- Exam shape definitions become versioned curriculum constants next to the grammar
  map / vocab base.
