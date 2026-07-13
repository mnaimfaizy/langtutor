# ADR 0047: Hybrid guide SoT — blueprint, own content, admin approval

## Status: Accepted

## Context

ADR 0045–0046 require a kids-first curriculum guide as shared SoT before
AI-invented units. Research recommended a **hybrid** licensing stance (not
OER-only, not a full commercial corpus dump). Product intent is to follow a
pedagogical **blueprint**, then create **original** Lang-Tutor content — much of
it AI-generated and learner-visible — without trapping the product in third-party
copyright of Cambridge/Pearson/etc. full lists or handbooks.

Existing product already has a human **pending approval** pattern for generated
media (admin gate before learners see assets).

## Decision

1. **Licensing stance = hybrid (Option A):**
   - Cambridge **Pre A1 Starters** = pedagogical north star via **cite + short
     human-approved excerpts** only — not a redistributed full wordlist/handbook.
   - **Letters and Sounds** (or equivalent) = **distilled** phonics spine we
     author/bundle with attribution (verify exact Crown/OGL terms before ship).
   - Do **not** commit full commercial corpora or rely on CC BY-NC as primary.

2. **Blueprint, not borrowed curriculum:** the in-product SoT is a
   Lang-Tutor-authored **syllabus spine / blueprint** _oriented by_ Starters (and
   the phonics distillation). We create our own units, vocab sets, activities,
   exams, and teacher plans — we do not need or ship Cambridge’s full curriculum
   as content.

3. **AI generates original content; humans approve:** runtime learner-facing
   material may be AI-generated following the blueprint, but a **human admin
   approval gate** sits before that material is trusted for learners (same spirit
   as the media pending gate). The blueprint/excerpts themselves remain
   human-curated.

4. **Copyright posture:** avoid depending on third-party protected wordlists or
   handbook text at scale in prompts or in the repo; prefer original generation
   constrained by our spine + short approved excerpts.

## Consequences

- v1 delivery shape remains along `data/curriculum-guides/pre-a1/` (spine,
  phonics distillation, short excerpts, `SOURCES.md`) per research — exact
  schema in a later ADR/PRD.
- Teacher invent/add-units (ADR 0045) consults **our** blueprint, not a
  Cambridge dump.
- Admin UX/workflow for approving AI path content may need to extend beyond
  media assets; scope of what must be approved is a follow-on grill point.
- Not legal advice — counsel should review before shipping third-party excerpts.
