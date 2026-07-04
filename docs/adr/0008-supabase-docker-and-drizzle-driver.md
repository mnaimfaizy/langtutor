# ADR 0008: Supabase Infrastructure & Driver Choices

## Status

Accepted

## Context

In Phase 2, we are introducing Supabase to handle Auth and Postgres data storage for Cloud Mode deployments. We need to decide how developers simulate Cloud Mode locally and how our repository layer connects to the database. We want to maximize parity with our existing `SqliteContentRepository`.

## Decision

1. **Local Development via Docker**: We will support running the full Supabase stack locally via Docker (e.g., Supabase CLI) for testing `MODE=cloud`. The actual managed Supabase cloud service is strictly reserved for production deployments.
2. **Direct Drizzle + Postgres Connection**: Instead of using the `@supabase/supabase-js` API client for data fetching, we will use Drizzle ORM directly with the `postgres.js` driver.

## Consequences

- **Positive**: High code reusability and parity between the SQLite and Postgres Drizzle schemas. We avoid splitting our data query logic into two completely different paradigms (Drizzle query builder vs Supabase JS client).
- **Positive**: `SupabaseAuthProvider` can use `@supabase/supabase-js` purely for identity management, adhering to single-responsibility.
- **Negative**: We must manage database connection pools and database schema migrations (using `drizzle-kit`) for Postgres, rather than exclusively relying on the Supabase dashboard.
