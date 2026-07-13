# ADR 0046: Kids-first pre-A1 guide; shared with adults; entertaining path

## Status: Accepted

## Context

ADR 0045 requires a verified curriculum guide as the shared source of truth
before AI-invented units. Pre-A1 serves both kid mode and adult opt-in
(`enablePreA1`). Kid and adult coursebooks differ in packaging, but the
fundamentals (alphabet, sounds, concrete vocab, listen-and-choose) overlap.

Product pain on the current four-unit path is “next, next, done” — thin and
unengaging for both audiences.

## Decision

1. **Kids-first guide:** the first curriculum guide / book framework is chosen
   for **kid beginners**. That guide is the SoT for the pre-A1 chapter.
2. **Adults share it:** adult pre-A1 learners use the **same** fundamental
   materials and syllabus spine (not a separate adult A0 coursebook as the
   primary SoT).
3. **Entertaining for both:** the pre-A1 environment (path, activities, teacher
   tone) must feel **friendly and entertaining** for kids and adults — not a
   dry linear checklist. Experience-mode differences (e.g. kid island vs adult
   chrome, teacher voice) may remain, but neither audience gets a boring
   next-next path.

## Consequences

- Guide research starts from child / YLE-style / early-years English frameworks,
  not adult CEFR A0 coursebooks as the primary reference.
- Adult `enablePreA1` content aligns to the kid syllabus; do not fork two
  pre-A1 spines.
- Richer units, multi-activity practice, and later AI-invented units (ADR 0040, 0045) are judged partly on engagement, not only coverage.
- Licensing and title selection still follow ADR 0040 / 0041 / 0045.
