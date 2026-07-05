# ADR 0012: Production Deployment on Vercel with Cloud Mode

## Status: Accepted

## Context

Lang-Tutor is ready for a public multi-user production deployment. Two hosting options were
considered:

1. **cPanel shared hosting** (the operator already has a plan with a Node.js option)
2. **Vercel** (purpose-built for Next.js)

The app was originally designed as a local-first, single-user install running on a personal laptop
with Ollama running AI models on a home Mac. The move to a public production deployment invalidates
three original locked decisions:

- **Decision #1** (single-user / local) — reversed by ADR 0001 (multi-user both modes)
- **Decision #4** (Ollama on Mac) — infeasible for serving multiple remote users
- **Decision #6** ("no Vercel") — that constraint was for the local-only single-user case

## Decision

### Hosting: Vercel

cPanel shared hosting is rejected for this deployment because:

- Next.js requires a **persistent Node.js process** with full control over the server — cPanel's
  Node.js (via Passenger) does not provide this reliably for the App Router.
- API routes act as an AI proxy with responses that can take several seconds — shared hosting
  environments enforce aggressive request timeouts.
- No persistent filesystem (or unreliable one) makes SQLite unsuitable on shared hosts.
- Vercel is the reference hosting platform for Next.js and natively supports all features in use
  (App Router, Server Actions, Turbopack builds, Edge config, streaming responses).

Vercel **Hobby** plan is chosen as the starting point:

- Groq uses LPUs (Language Processing Units) and returns most completions in 2–6 seconds, keeping
  AI proxy routes within the 10 s default timeout.
- Content-generation routes (which may be longer) will be configured with `export const maxDuration`
  and streaming via the Vercel AI SDK to avoid hard timeout kills.
- Upgrade to **Vercel Pro** if sustained timeout issues emerge in production.

### App mode: `LANGTUTOR_MODE=cloud`

Vercel has no persistent filesystem, so SQLite (`local` mode) is infeasible. The `cloud` mode
(Supabase Postgres + Supabase Auth) already implemented in ADRs 0001–0011 is used for production.

### AI providers: Groq (chat + STT) + Mistral (embeddings)

The home Mac running Ollama cannot serve remote users. Cloud AI APIs — already wired in ADR 0010
and the `GROQ_API_KEY` / `MISTRAL_API_KEY` env vars — become the production AI backends.

- `chatProvider: "groq"` · model: `llama-3.3-70b-versatile` (or per `GROQ_CHAT_MODEL`)
- `sttProvider: "groq"` · model: `whisper-large-v3` (or per `GROQ_STT_MODEL`)
- `embedProvider: "mistral"` · model: `mistral-embed` (or per `MISTRAL_EMBED_MODEL`)
- The Mac/Ollama path remains available for local development and self-hosted installs.

### Database: Supabase (Postgres)

Supabase is the `cloud` mode database per ADR 0001. A production Supabase project (not the local
Docker instance) is provisioned for this deployment. All Drizzle migrations are applied via the
existing `drizzle.postgres.config.ts`.

### Domain: `*.vercel.app` (initially)

No custom domain at launch. The operator may add a custom domain later via Vercel's dashboard
and a DNS CNAME update — no code changes required.

### Self-service registration

Users self-register via Supabase Auth. This **amends ADR 0001** which stated "No self-registration
— admins create users." For a public deployment, requiring admin-created accounts is impractical.
The admin bootstrap flow (ADR 0011) remains unchanged for the first admin.

> **Risk noted:** With free-tier Groq/Mistral keys and open self-registration, the shared rate
> limit may be exhausted by multiple active users. Per-user AI request rate limiting is a
> **required follow-up feature** before the app is promoted widely (tracked as a handoff item).

## Consequences

**Positive:**

- Zero infrastructure to manage — Vercel handles builds, deploys, CDN, SSL.
- CI/CD from `git push` to production in minutes (GitHub → Vercel integration).
- Groq's LPU speed makes Hobby plan viable; no upfront plan cost.
- Supabase free tier covers early users; upgrade path is a slider.

**Negative:**

- Vercel Hobby function timeout (10 s) is tight for content-generation routes; streaming +
  `maxDuration` annotations required on those routes.
- Free Groq/Mistral keys have daily request caps; exhaustion will break AI features for all users
  until the following day. Rate limiting must be added before a wide public launch.
- The Mac/Ollama STT path is unavailable remotely; Groq Whisper becomes the only STT provider.
- Serverless cold starts may add ~300–800 ms latency on first request after idle periods.
