# ADR 0011: Cloud Admin Bootstrap Security

## Status

Accepted

## Context

In Phase 1b (Local Mode), the first user is bootstrapped via a one-time public "Create Admin" UI, which is acceptable since the app is running on `localhost`. For Phase 2 (Cloud Mode), the app is exposed to the public internet. Leaving a public setup UI open presents a race-condition vulnerability where a malicious actor could claim the administrative account before the operator does.

## Decision

We will employ **Environment Variables on Boot** to bootstrap the initial admin in Cloud Mode.

- The operator will provide `LANGTUTOR_ADMIN_EMAIL` and `LANGTUTOR_ADMIN_PASSWORD` in the production environment variables (`.env`).
- On server initialization or first route hit, the application securely checks if an admin exists. If not, it utilizes the Supabase Admin API to create the initial admin user using the provided credentials.

## Consequences

- **Positive:** Closes the public setup vulnerability completely. The first-run UI is never exposed in Cloud Mode.
- **Positive:** Automates deployment pipelines, removing the need for manual SQL execution to set up the first user.
- **Negative:** The operator must ensure their deployment platform handles environment variables securely to avoid leaking the initial admin password.
