# ADR 0031: Proactive generate is one-at-a-time in v1

## Status: Accepted

## Context

ADR 0026 adds a curriculum gap helper alongside free-text proactive generate.
Batch “generate all missing” would fill the pending queue quickly but increases
provider cost, failure handling complexity, and review load.

## Decision

v1 proactive generate (free-text and gap helper) is **one-at-a-time only**:
admin selects or types a single word/phrase, then generates.

Multi-select / generate-all-missing is deferred.

## Consequences

- Simpler admin UI and server actions (single-key generate).
- Filling many gaps is manual repetition — acceptable for v1 single-user /
  small-admin workflows.
- Batch can be revisited if pending-queue throughput becomes a bottleneck.
