# ADR 0041: Curriculum research = bundled guides + model knowledge (v1)

## Status: Accepted

## Context

ADR 0040 wants verified curriculum guides plus room for the teacher to go beyond
them. Option C (guides + optional live research) was attractive, but the codebase
has **no LLM tool-calling** today (`LLMClient` is chat/stream/embed only; the
enrichment “agent” is a single Zod chat, not web search). Live research would be
a new seam with different local vs cloud wiring.

## Decision

For **v1** of mastery gates / teacher reports / richer planning grounded in guides:

1. Deliver **bundled (or server-retrieved) curriculum guides** into teacher prompts.
2. Allow the model to adapt using **its own knowledge** beyond the guide.
3. **Do not** ship live web/tool search for curriculum research in this phase.

A future `ResearchProvider` / tool-calling loop remains possible later; it is out
of scope for the gate/teacher-report workstream.

## Consequences

- Guide corpus + licensing research becomes a prerequisite deliverable.
- Offline story stays simple: guides are local assets; exams/plans still pre-buffer
  (ADR 0037).
- No new Mac/cloud search API keys for this feature.
- Teacher prompts must say: follow the guide as fundamental orientation; you may
  add helpful material, but do not contradict the grammar backbone or exam shape.
- Delivery mechanism within “bundled”: full inject vs retrieve-relevant-sections
  can be chosen at implement time (prefer retrieve if guides are large).
