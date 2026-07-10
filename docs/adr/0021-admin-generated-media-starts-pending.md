# ADR 0021: Admin-generated media starts pending

## Status: Accepted

## Context

ADR 0020 lets admins regenerate existing media and proactively generate missing
media. That raises a visibility question: when the new bytes replace (or would
replace) an asset learners already rely on — including curated-pack images —
should learners see the new output immediately?

Options considered: immediate approve (admin-trusted), pending with a temporary
learner gap, or keep-old-until-approve (staging / dual version).

## Decision

**Admin regenerate and proactive generate always store the new asset as
`approvalStatus: "pending"`.**

Until an admin explicitly approves:

- Learners do **not** receive the new bytes via resolve routes.
- For images: resolve returns unavailable (404) for that key.
- For audio: resolve returns unavailable / silence for that key (same gate).

There is no keep-old-live staging slot in v1: writing the new pending asset
replaces the previous row for `(kind, key, style)`, so learners may see a
temporary gap after regenerate until re-approval.

## Consequences

- Kid-safety review remains mandatory even for admin-triggered generations.
- Regenerating an approved pack or generated asset creates a deliberate
  availability gap until re-approve — UI should warn before regenerate.
- Dual-version / staging (keep approved live while pending is reviewed) is
  deferred; would need schema or side-table support if revisited.
