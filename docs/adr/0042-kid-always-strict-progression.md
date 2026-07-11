# ADR 0042: Kid accounts always strict; adults may choose open

## Status: Accepted

## Context

ADR 0033 introduced strict (default) vs open progression. Kid learners are the
primary audience for pre-A1 mastery; allowing open mode would recreate “next,
next, done” for the group that needs gates most.

## Decision

- **Kid experience mode:** progression is **always strict**. Open mode is not
  offered in the UI for kid accounts.
- **Adult experience mode:** default **strict**; the learner may switch to **open**
  in Settings.

Experience mode (`kid` | `adult`) remains the switch that controls this, not a
separate parental PIN for v1 (no parent accounts yet).

## Consequences

- Settings UI: progression-mode control only when `experienceMode === "adult"`.
- If an adult account switches to kid mode later, force strict (ignore stored open).
- Open-mode code paths still exist for adults; kid path never reads open.
