# ADR 0007: Local mode redefines "offline"

## Status: Accepted

## Context

v1 was a static PWA + browser DB, so it worked **fully client-side** offline. Moving data to
server-side SQLite (ADR 0002) changes what "offline" means.

## Decision

- In **local mode**, data lives in server-side SQLite served by the **same local Next process**.
  "Offline" means **no internet required** — but the local server must be running (it always is when
  the app is running). The Serwist PWA still caches the app shell; data reads/writes now require the
  local server.
- In **cloud mode**, data requires connectivity (expected).
- An offline write queue / sync for cloud is **out of scope** (future).

## Consequences

- The local-first promise holds for local mode (localhost is always available when the app runs).
- Pure client-only offline (app served statically with no server) is **no longer supported**.
- Documented in deployment docs so self-hosters understand the runtime requirement.
