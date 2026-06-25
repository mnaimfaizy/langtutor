# ADR 0002: Data isolation via Transport A (preserve the seam, move the store server-side)

## Status: Accepted

## Context

All learner data lives in **browser IndexedDB** via `DexieContentRepository`, **unscoped**.
Multi-user isolation can't be enforced client-side (any logged-in user's JS could read all rows),
so the store must move **server-side**. Crucially, there is exactly **one** data seam —
`ContentRepository` covers profile, cards, content, errorEvents, weakness, gamification,
lexiconCache, and backup — and all ~27 call sites already use the interface (none touch Dexie).
The call sites, however, live in `"use client"` components, and SQLite is server-only.

## Decision

- **Transport A**: keep the `ContentRepository` **interface unchanged**; swap the transport.
  - Client `HttpContentRepository` implements the interface by calling **Server Actions**.
  - Server runs `SqliteContentRepository` (local) / `SupabaseContentRepository` (cloud), **scoped
    by session `userId`**. Registry picks the concrete by mode.
- **Phased, no theater**:
  - **1a** — relocate the whole store server-side, **still single-user**, with an
    **identity-aware transport** (every action resolves a current user; a **stub admin** in 1a).
  - **1b** — add users/sessions/roles + `userId` scoping; replace the stub resolver with real
    sessions. The transport is not reworked.

Rejected: (B) rewriting the 27 call sites to server components/actions directly — a real rewrite,
and interactive components resist becoming server components. (C) client-side scoping in IndexedDB —
no real isolation.

## Consequences

- A network hop per repo call — negligible, since call sites are already interactive client
  components.
- We forfeit reading data directly in server components (acceptable).
- The app now depends on a running local server in local mode (see ADR 0007).
- Cloud later = a `SupabaseContentRepository` behind the **same** interface.
- Migration method-by-method is avoided — the single seam flips at once, so there's never a hybrid
  split-brain store.
