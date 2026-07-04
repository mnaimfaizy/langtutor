# ADR 0010: Cloud AI Secrets Management

## Status

Accepted

## Context

In Phase 3, we will extend `appConfig` to support Cloud AI providers (e.g., Groq, Gemini) as alternatives to the local Mac endpoints. We need a secure strategy for managing the API keys required to communicate with these providers.

## Decision

We will employ **Option 1: Environment Variables Only (`.env`)**.

- API Keys (e.g., `GROQ_API_KEY`, `GEMINI_API_KEY`) will be injected purely at deploy time.
- The global `appConfig` database table will only store **routing and provider selection** data (e.g., `chatProvider: "groq"`, `sttProvider: "mac"`), while the actual authentication mechanism pulls from the server environment.

## Consequences

- **Positive:** High security layout. Plaintext API keys will never touch our database and cannot be leaked via SQL injection or unauthorized access to the `appConfig` table.
- **Positive:** Conforms with 12-factor app design methodology.
- **Negative:** Admins cannot swap API keys dynamically from the Lang-Tutor UI; a restart/redeploy is necessary to cycle keys.
