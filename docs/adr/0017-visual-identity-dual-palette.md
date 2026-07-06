# ADR 0017: Visual identity — premium dark adult mode, bright kid mode

## Status: Accepted

## Context

The current UI is dark, monochrome, and developer-tool sterile. The revamp must make
the app genuinely attractive for studying. Directions considered: playful/vibrant
throughout (Duolingo-like — rejected: infantilizes the adult experience), warm-modern
light adult theme (rejected in favor of evolving the existing dark identity), and
premium dark & polished.

Kids' products are conventionally bright/light (early-reader readability, parental
expectations, daytime use), which tensions with a dark brand.

## Decision

- **Brand/adult mode: premium dark & polished** — gradients, glass, glow, rich
  motion; an elevated version of the current dark aesthetic.
- **Kid mode flips to a bright/light palette** while sharing the same design system
  (tokens, components, spacing, motion language). Experience mode (ADR 0014) selects
  the palette.
- Hard rule 7 (light + dark support via Tailwind theme tokens) still applies to both
  modes.

## Consequences

- The Tailwind token set must support two palette families (premium-dark,
  bright-kid) selected by experience mode, on top of the light/dark axis.
- `ui/` components must render correctly under both palettes — no hardcoded colors.
- Marketing landing page carries the premium-dark brand.
- Mascot/illustration art direction must work on both dark and bright surfaces.
