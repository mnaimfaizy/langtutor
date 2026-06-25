# ADR 0006: Server Actions as the data-repository transport

## Status: Accepted

## Context

Transport A (ADR 0002) needs the client `HttpContentRepository` to reach the server-side repo.
Options: Next **Server Actions** vs **route handlers** (`app/api/*`). This is orthogonal to the
Mac/AI proxies, which are route handlers regardless.

## Decision

- Use **Server Actions** for the data-repository transport — one action per `ContentRepository`
  method; the client adapter imports and awaits them. Identity is resolved server-side per call
  (`resolveCurrentUser`).
- Keep `app/api/llm/*` and `app/api/stt/*` as **route handlers** (unchanged).

Rejected: route handlers for the data repo — more boilerplate and manual per-method
request/response typing across ~20 methods.

## Consequences

- Minimal boilerplate, type-safe end-to-end, naturally identity-aware.
- Next-coupled and POST-only (acceptable — we're not splitting the backend out).
- The client adapter stays a thin pass-through over the actions.
