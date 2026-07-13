# ADR 0048: Starter path live; admin gates templates not every fill

## Status: Accepted

## Context

ADR 0047 requires human admin approval of AI-generated material in spirit, without
trapping the product in third-party copyright. Blocking every AI fill behind admin
would stall a learner’s **first login** — they must see a plan and be able to
start. Pure auto-publish of all AI path content weakens the approval gate.

## Decision

**Middle path (option 3):**

1. **Human-approved once:** the syllabus spine/blueprint, short excerpts, phonics
   distillation, and **starter unit templates** (the pre-filled opening plan for
   pre-A1) are curated/approved by admin (or shipped as product-authored assets).
2. **First login never blocked:** a new pre-A1 learner immediately sees a
   **pre-filled starter plan** and can begin activities — no wait on Mac/admin for
   day-one path visibility.
3. **Routine fills may auto-serve:** ongoing exam item fills, activity content
   within approved templates, and similar buffered generation can go to learners
   without per-item admin approval (still Zod-validated; seams unchanged).
4. **Admin re-enters for expansion:** richer templates, invented units beyond the
   starter, or blueprint changes go through human approval before they become the
   trusted plan for learners.

Exact shape of the starter plan and post-starter progression within pre-A1 remain
follow-on grill decisions (this ADR locks the approval/bootstrap policy only).

## Consequences

- Product must ship (or pre-buffer and approve) a concrete pre-A1 starter plan.
- Teacher invent/add-units after the starter is gated by admin/blueprint rules
  (ADR 0045, 0047) — not free-fire on first session.
- Aligns with offline/buffer spirit: day-one UX does not depend on live AI.
- Media pending gate remains for images/audio; path-content approval is a
  separate, coarser gate (templates/spine, not every item).
