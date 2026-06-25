# ADR 0004: Hand-rolled local auth behind a minimal AuthProvider seam

## Status: Accepted

## Context

Cloud auth = **Supabase Auth** (managed: JWT, OAuth, email verify, password reset). Local auth is
self-hosted. These are genuinely different systems, so a shared seam must stay small or it leaks one
system's assumptions into the other. Local needs are modest: password login, sessions, two roles, no
self-registration.

## Decision

- A **thin `AuthProvider` seam**: `getCurrentUser(req)`, `signIn`, `signOut`, `createUser`
  (admin-only), `listUsers`, `deleteUser`. **No self-registration**; first user = admin.
- **Local adapter (hand-rolled, ships in 1b)**: argon2id password hashing + a `sessions` table
  (Drizzle) + httpOnly/SameSite cookie + a guard that resolves the session.
- **Cloud adapter (later)**: `SupabaseAuthProvider` wraps Supabase Auth behind the same interface.
- OAuth / 2FA / email-verify are **out of scope for local**.

Rejected: Better Auth (extra dependency; cloud is Supabase regardless, so two systems either way) —
revisit only if local needs OAuth/2FA. Auth.js/NextAuth v5 (OAuth-first; credentials/roles
second-class; awkward Supabase swap).

## Consequences

- We own a small amount of security-sensitive code locally (cookie flags, expiry, CSRF) — small,
  well-trodden surface, gated by `/security-review`.
- The seam stays fully under our control; two implementations behind one interface.
- The Phase 1a transport is built **identity-aware** (stub resolver) so 1b only fills in real
  session resolution.
