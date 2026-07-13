# ADR 0045: Curriculum guides as source of truth before AI-invented units

## Status: Accepted

## Context

ADR 0040 expands pre-A1 and lets the teacher adapt beyond a guide. ADR 0043
shipped the first mastery-gate slice on the four existing units. Product intent
now is a denser pre-A1 path where the AI teacher can invent/add units — but
without a shared reference, humans and the model will diverge (hallucinated
topics, inconsistent vocab, conflicting “plans”).

Alternatives considered:

1. Expand units first from ad-hoc product judgment, wire guides later.
2. Let the AI invent pre-A1 units immediately, constrained only by prompts.
3. Lock a verified curriculum guide (or small set of guides) as the shared
   source of truth first; only then allow the AI teacher to invent/add units
   within that framework.

## Decision

**Guides first, invention second.**

1. Select and adopt proper language-learning guide(s)/book frameworks that we
   and the AI teacher both treat as the **source of truth** for pre-A1 (and
   later tiers as guides are added).
2. Until that corpus exists and is wired into teacher prompts (ADR 0041:
   bundled/retrieved, no live search), do **not** ship AI invent/add-unit
   behaviour for pre-A1.
3. After the guide is in place, the AI teacher may invent/add units and plans
   **oriented by** that guide — still not free to contradict backbone/curriculum
   constants (ADR 0032, ADR 0040 “not a straitjacket”).

Exact titles, licensing, and extraction format remain a research follow-on;
this ADR locks **order of work** and the SoT role of the guide.

## Consequences

- Next implementation/research work prioritises guide selection + licensing +
  bundling over richer seeding or dynamic unit creation.
- ADR 0040’s “more units / multi-activity” and AI-invented paths become a
  **later slice** gated on the guide SoT.
- Teacher prompts must cite/consult the guide so humans and model share one
  syllabus spine; Zod contracts stay the runtime safety net, not the curriculum.
- Hallucination risk is reduced by shared reference, not by freezing the path
  forever — invention is delayed, not rejected.
