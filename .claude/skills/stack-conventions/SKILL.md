---
name: stack-conventions
description: Use when writing or reviewing app, UI, or library code. Covers Next.js 16 / React 19 (server components by default), TypeScript strict, Tailwind v4 tokens, Base UI via the ui/ layer, accessibility, and Zod / FSRS patterns.
---

# Stack conventions

Stack: Next.js 16 · React 19 · Turbopack · Tailwind v4 · Base UI (via `ui/`) · Dexie · Zustand ·
Zod · Vercel AI SDK · `ts-fsrs` · Vitest · Playwright · TypeScript strict.

## React / Next.js

- **Server Components by default.** Add `"use client"` only when the component needs
  interactivity (state, effects, event handlers, browser APIs). Keep client components small and
  at the leaves of the tree.
- All access to the Mac goes through `app/api/*` route handlers (see the `seam-discipline` skill).
- Co-locate route UI under `app/`; shared logic under `lib/`; reusable presentational components
  under `ui/`.

## TypeScript

- **Strict mode; no `any`** in committed code. Prefer precise types and discriminated unions.
- Pure logic (FSRS wrapper, validators, WER, gamification, weakness model) lives in `lib/` as
  **side-effect-free functions** so it's unit-testable without a browser.

## Tailwind v4

- Use the theme tokens defined in `app/globals.css` (`bg-background`, `text-foreground`,
  `text-muted`, `bg-accent`, …) instead of hard-coded hex. Support light + dark.
- `prettier-plugin-tailwindcss` sorts class lists automatically — don't hand-order classes.

## UI (Base UI)

- **No feature code imports Base UI directly.** Everything goes through our own wrappers in
  `ui/` (Button, Dialog, Tooltip, …). This keeps the primitive lib swappable.
- If Base UI lacks a primitive, hand-build the wrapper with the same `ui/` API surface.
- Accessibility is not optional: keyboard operable, `focus-visible`, correct roles/labels,
  and respect `prefers-reduced-motion`.

## Data & validation

- **Zod at every boundary** (LLM output, agent output, dictionary APIs, import/export). Parse,
  don't cast.
- SRS scheduling is **FSRS via `ts-fsrs`** (ratings Again / Hard / Good / Easy) — never SM2.
- Persisted data goes through `ContentRepository` (Dexie), never raw IndexedDB in features.

## Quality bar (Definition of Done, §3.3)

Code compiles & lints clean · `pnpm verify` green · the step's Accept + Verify pass · no
regression in existing suites.
