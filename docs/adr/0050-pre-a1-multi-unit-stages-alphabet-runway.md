# ADR 0050: Pre-A1 starter = multi-unit stages + Alphabet runway into letters & sounds

## Status: Accepted

## Context

ADR 0049 keeps the four pre-A1 skill families but requires a gentler KG ramp than
today’s single Alphabet unit then hard Phonics jump. Two shapes were attractive:

- Split each family into several small units (Alphabet×N → Phonics×N → …).
- Longer Alphabet runway that folds early phonics into gentler “letters & sounds”
  before a labeled Phonics stage.

Choosing only one leaves either a still-steep first phonics label, or a flatter
ladder without enough early letter–sound glue.

## Decision

**Combine both:**

1. **Multi-unit stages:** each of the four families (Alphabet, Phonics, Picture
   words, Listen & tap) is a **stage** of several small units, not one unit per
   family.
2. **Alphabet runway into letters & sounds:** the opening stage is a longer
   Alphabet / early literacy runway. Early GPC work appears as gentle
   **letters & sounds** units inside or immediately after that runway — not as an
   abrupt leap into a hard “Phonics” unit. The explicit **Phonics** stage comes
   after that runway when learners are ready.
3. Later stages (Picture words, Listen & tap) similarly use multiple small units
   once the starter design spells out counts.
4. Exact N per stage and activity shapes are specified in the spine/PRD; this ADR
   locks the **pedagogical shape** of the shared kid starter.

## Consequences

- `seedPreA1Units` / spine must grow beyond four single-activity placeholders.
- Chapter exam skill sections can still map to the four families (ADR 0037 shape)
  even when each family has multiple units — confirm in exam design when counts
  land.
- Kid Island / path UI must present stages or many small nodes without feeling
  like “next next” boredom (ADR 0046 entertainment bar).
- AI expansions (ADR 0049) add units **within or beyond** these stages only after
  the shared starter is in play — trigger still TBD.
