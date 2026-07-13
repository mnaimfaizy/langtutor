# ADR 0056: Migrate legacy four-unit pre-A1; preserve gate, do not replay runway

## Status: Accepted

## Context

Before ADR 0053, every pre-A1 learner had exactly four single-activity units at
path indices `−4…−1` (Alphabet → Phonics → Picture words → Listen & tap). The
shared starter now materializes six catalog units (`−6…−1`) with a multi-unit
Alphabet runway. Existing profiles still holding the old four rows would break
stage grouping, review-assignment indices, and (for gate-passed kids) risk a
forced runway replay if we naïvely re-seeded.

## Decision

1. **Detect** the legacy shape: exactly four negative-index units at `−4…−1`
   whose titles or primary activity skills match the old seeder.
2. **Map** each legacy unit’s status onto the matching shared **stage**:
   completed → every catalog unit in that stage completed; in-progress /
   available → only the first catalog unit of that stage resumes; later stages
   stay locked.
3. **Gate-passed (and any existing gate row):** **preserve** gate status and
   unit-0 unlock; replace legacy rows with the shared starter marked complete.
   Do **not** force a runway replay. Learners who already entered the gate
   lifecycle keep exam access even when the shared enrichment bar is not yet
   cleared for new completers (`resolveStagesReadyForExam` grandfathers an
   existing gate row).
4. **Fresh kids:** unchanged — still materialize from the shared catalog only.

## Consequences

- Home/`ensurePath` runs an idempotent migrate-or-map before pre-A1 sync.
- Review-assignment `unitIndex` values from the old `−4…−1` skill map are
  remapped to the current stage review indices.
- Migration is silent (no unit-completed events / XP / collectibles).
