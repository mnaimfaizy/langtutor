# ADR 0018: Public marketing landing page

## Status: Accepted

## Context

Unauthenticated visitors are currently dumped straight onto `/login`. The app has
outgrown its single-user framing: it has sign-up, roles, and a cloud deployment
(Vercel + Supabase). Alternatives: a minimal "beautiful front door" for known users
only, or a marketing page shown to strangers with logged-in users skipping past it.

## Decision

Build a **full public marketing landing page**: hero, feature sections, visuals of
the product, and a sign-up CTA — designed for strangers evaluating the product.
It carries the premium-dark brand (ADR 0017). Logged-in users are routed to their
learning path home instead.

This workstream ships **first after the design-system refresh** — it is the
smallest, is independent of the path/curriculum work, and sets the visual bar.

## Consequences

- Route structure change: `/` becomes the marketing page for anonymous visitors;
  authenticated users land on the path home.
- Needs product screenshots/illustrations, which depend on the design refresh.
- Sign-up funnel becomes a first-class flow (including experience-mode selection,
  ADR 0014).
