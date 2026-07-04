# ADR 0009: Row Level Security with App-Enforced Scoping

## Status

Accepted

## Context

In Phase 2, we are migrating to Supabase (Postgres) and connecting directly via Drizzle ORM using `postgres.js` (ADR 0008). Because we bypass the PostgREST API and `@supabase/supabase-js` for database queries, we do not inherently map JWTs to database roles. We need to decide how to implement multi-user data isolation.

## Decision

We will employ **Option 2: App-enforced scoping + RLS via SQL Session Variables as defense-in-depth.**

1. **App-enforced scoping:** We will continue to use Drizzle `.where()` clauses (e.g., `.where(eq(tables.profile.userId, session.userId))`) to maintain code structure parity with the `SqliteContentRepository`.
2. **Defense-in-depth RLS:** We will enable Row Level Security (RLS) on all per-user tables in Postgres.
3. **Session Variable injection:** Before executing queries in the Postgres adapter, we will wrap operations in a transaction that executes `set_config('request.jwt.claim.sub', currentUserId, true)`. The RLS policies will be written to evaluate this local configuration variable.

## Consequences

- **Positive:** Exceptional security posture via defense-in-depth. If an application-level `.where()` clause is forgotten, the database RLS will still block unauthorized reads or writes.
- **Positive:** Adheres to the master plan's goal of true data isolation.
- **Negative:** Minor performance overhead due to wrapping operations in transactions to securely set local connection configurations.
