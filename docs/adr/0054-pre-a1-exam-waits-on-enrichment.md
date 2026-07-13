# ADR 0054: Pre-A1 exam after four stages; A1 gate waits on enrichment bar

## Status: Accepted

## Context

ADR 0053 ships a full four-stage skeleton with only Alphabet richly filled; later
stages may be thin placeholders. The existing mastery gate (PRD #113 / ADR 0043)
runs a chapter exam before A1. If thin placeholders alone satisfied the gate,
KG learners could reach A1 under-prepared. If the exam moved to Alphabet-only,
later stages become optional and the chapter exam no longer matches the four
skill families.

## Decision

1. The **pre-A1 chapter exam remains after all four stages** (Alphabet → Phonics
   → Picture words → Listen & tap), not after Alphabet alone.
2. **A1 unlock (the mastery gate) does not fire on thin placeholders alone.**
   Later stages must meet a **shared enrichment minimum bar** (content quality /
   coverage in the shared path cache) before the chapter exam is offered / before
   A1 can unlock.
3. Learners who finish placeholder units early **wait on shared enrichment** (or
   play newly approved shared enrichment as it lands) **before the gate** — they
   are not stuck on a per-user AI/admin loop (ADR 0051).
4. Exact definition of the enrichment bar (e.g. N rich units per stage, activity
   kinds present, admin “stage ready” flag) is specified in the PRD/spine — this
   ADR locks the **policy**.

## Consequences

- Home/path UX needs a clear “chapter growing / not ready for exam yet” state.
- Admin priority to enrich Phonics → Picture words → Listen & tap directly
  unblocks the gate for **everyone** on the shared cache.
- Open/strict progression modes (ADR 0033+) still apply to the exam once it is
  offered; this ADR adds a **pre-exam readiness** condition on shared content.
- Exam skill shape can stay aligned to the four families (ADR 0037) once stages
  are enriched enough to examine fairly.
