# ADR 0028: Generated audio uses the pending approval gate

## Status: Accepted

## Context

Generated images enter `media_assets` as `pending` and are hidden from learners
until admin approval. Generated TTS audio currently hardcodes
`approvalStatus: "approved"` in `resolveWordAudio`, so clips (including bad or
over-long ones) can reach learners with no review. ADR 0021 stated the pending
gate for admin-triggered media; this ADR aligns **all** new generated audio with
that gate.

## Decision

**New generated audio** (learner `/api/audio/resolve` miss, admin proactive
generate, and admin regenerate) is stored as **`pending`**.

Learners receive audio via resolve only when the asset is **approved** (same
visibility rules as images). The admin audio page (ADR 0025) is the review
surface: play, approve, purge, regenerate.

Policy for **existing** rows that were auto-approved under the old behavior is
a follow-on decision if not specified separately.

## Consequences

- Change `resolveWordAudio` / produce path to use
  `defaultMediaAssetApproval("generated")` (or equivalent) instead of hardcoding
  approved.
- Audio resolve must not return pending bytes to learners (404 / unavailable).
- First-time uncovered words will have silent/missing audio until admin
  approves — same UX tradeoff as images.
- Existing approved generated audio remains playable until an explicit
  migration/re-pending policy is chosen.
