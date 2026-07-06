# ADR 0014: Per-account experience mode (kid / adult)

## Status: Accepted

## Context

The UI/UX revamp must serve two audiences: actual children learning English from
zero, and adult learners (absolute beginners through C2). The current interface is
adult-oriented everywhere, even though content spans A1–C2. Alternatives considered:

- **One adaptive UI driven by CEFR level** — playfulness scales down as level rises.
  Rejected: conflates _content difficulty_ with _presentation style_; an adult A1
  beginner would be forced into a childish UI.
- **Kid-mode toggle flipped by admin/parent** — rejected as a weaker version of the
  chosen option; the mode belongs to the account, not to an admin afterthought.

## Decision

Each user account carries an **experience mode** (`kid` | `adult`), chosen at
sign-up/onboarding. The mode drives visual theme, navigation density, and content
presentation style. CEFR level remains an independent axis (a kid can progress
levels; an adult beginner keeps the adult look at A1).

## Consequences

- Profile/settings schema gains an experience-mode field; onboarding must ask for it.
- UI components need to support two presentation variants (or theme-token sets).
- Content generation prompts may need a kid-appropriate register per mode.
- Landing page and gamification design must account for both modes.
