# ADR 0040: Richer pre-A1 chapter; verified curriculum guides for the teacher

## Status: Accepted

## Context

Pre-A1 today is four single-activity units with completion-only unlock. Product
intent for kids/true beginners needs a denser basics chapter (more units, deeper
practice) plus chapter mastery gates (ADR 0035+). Separately, the AI teacher needs
grounding in professional language-teaching practice — not a hand-wavy prompt —
without becoming a rigid rule engine that cannot adapt.

## Decision

1. **Pre-A1 content (Option B):** expand the pre-A1 chapter with **more units** and
   **multi-activity** practice where needed, still ending in a chapter exam.
2. **Curriculum guides:** give the AI teacher access to **verified reference
   materials** (well-known learner syllabi / course-book frameworks for pre-A1,
   A1–A2, …) as a **general fundamental guide** when planning units, filling exam
   items, and writing reports.
3. **Not a straitjacket:** guides constrain and inform; the teacher may go beyond
   them when a topic needs extra material (additional vocab, extra practice focus),
   as long as grammar-backbone order and curriculum constants remain intact
   (ADR 0032).

Exact book/syllabus list and licensing are a research follow-on; this ADR locks the
policy (verified guides + adaptive teacher), not a specific title yet.

## Consequences

- Pre-A1 seeding (`seedPreA1Units`) must grow beyond the current four placeholders.
- Need a durable way to store/version curriculum guides for the teacher (mechanism
  TBD — bundled excerpts vs retrieval vs runtime research).
- Licensing: only redistributable / properly licensed sources may be bundled;
  otherwise cite externally and use short fair-use-style excerpts in prompts with
  human approval.
- Teacher prompts gain a “consult guide, then adapt” instruction; Zod outputs stay
  the contract.
- Follow-on: how guides are delivered — **bundled/retrieved into prompts + model
  knowledge only for v1** (ADR 0041); live research deferred.
