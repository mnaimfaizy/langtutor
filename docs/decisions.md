# Decisions — Lang-Tutor

> Risks, mitigations, legal notes, explicitly dropped features, and open roadmap items.

> **⚠️ 2026-06 — locked decision #1 is being reversed.** The app is moving to **multi-user, with
> auth, in both a local (SQLite) and a cloud (Supabase) mode**. This invalidates the single-user
> threat model below: the **"Accepted security risks"** are no longer accepted and must be fixed
> (tracked in Phase 1b / Phase 2), and the Supabase/multi-user item under "Explicitly dropped" is
> back **in scope**. See `tmp/auth-multiuser-plan.md` and `docs/adr/0001`–`0007`.

## Risks & mitigations

| Risk                                                       | Mitigation                                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Serwist ↔ Turbopack** build friction                     | Resolved in Phase 0.7 via `@serwist/turbopack` — esbuild compiles `app/sw.ts` inside a route handler.          |
| **Base UI immaturity** (missing components / API churn)    | All usage behind `ui/` wrappers; hand-build missing primitives; swap lib without touching features.            |
| **Agent-doc / skill drift** (`AGENTS.md`, skills go stale) | Update them at every feature close-out. Stale agent docs are worse than none.                                  |
| **Mac unreachable** (asleep/away)                          | Offline backbone + generate-and-cache; clear "connect to Mac" states in every module.                          |
| **Mixed-content/CORS**                                     | Server-side proxy only; browser never calls the Mac directly.                                                  |
| **14B output quality / JSON drift**                        | Zod validation + corrective retries; utility model for cheap checks; primary model swappable.                  |
| **CEFR data is "estimated"**                               | Treat as guidance not truth; validator flags, doesn't hard-block learning; enrichment agent improves coverage. |
| **Whisper server setup**                                   | Isolated to Phase 6 behind `Transcriber` seam; app fully functional through Phase 5 without it.                |
| **Single-device data loss**                                | JSON export/import (Phase 8.2); revisit cloud sync only if multi-device need is real.                          |

## Accepted security risks

- **Server-held runtime config persists until restart**: config override set via `POST /api/llm/config` or `POST /api/stt/config` is in-process memory; a crash clears it. The app re-pushes on next load via `settings-bootstrap.tsx`.

Previously accepted risks — fixed in Phase 1b.6:

- **SSRF via `baseURL`/`sttUrl`**: closed by loopback/LAN allowlist (`lib/server/ssrf.ts`) + admin gate on config routes.
- **`GET /api/stt/health` error leakage**: error now logged server-side; only a generic status is returned to the caller.
- **Insecure `LANGTUTOR_SESSION_SECRET` default**: secret is required at boot; insecure placeholder is rejected by Zod.

## Legal / content note

All bundled data must be license-clean for redistribution:

- **WordNet** — OK (Princeton WordNet license).
- **Words-CEFR-Dataset** — check its license before redistribution.
- **Free Dictionary / Wiktionary content** — attribute per terms; only structured facts cached, not copied prose.
- **Oxford / WordsAPI / Cambridge EVP/EGP** — **excluded** as non-redistributable/paid.

The enrichment agent stores **structured facts** (definitions, CEFR, POS), not copied prose, and everything passes the `ContentValidator`.

## Explicitly dropped (and why)

- **Supabase/PostgreSQL/RLS, batched cloud sync, multi-user, WebSockets** → single-user local (locked decision #1)
- **In-browser WebLLM/WebGPU** → Mac models give higher quality without device constraints (locked decision #4)
- **Oxford/WordsAPI/Cambridge** APIs → free/open bundled data (locked decision #8)
- **Azure pronunciation as primary** → local Whisper + phonetic WER; Azure is an optional later swap behind the `Transcriber` seam
- **Big pre-generated content library** → generate-and-cache + tiny seed (locked decision #3)
- **Async serverless/DB-trigger gamification** → local instant (locked decision #14)
- **SM2/DolphinSR** → FSRS (locked decision #10)
- **Dedicated-exam-first diagnostics** → continuous error events from day one

## Open roadmap items

These are not blocking but are candidates for future phases:

- **Cloud sync / multi-device** — the first real reason to re-introduce a backend. The `ContentRepository` seam is ready; add a `SyncedRepository` impl.
- **Optional cloud LLM/STT swap-in** — for quality or when away from the Mac. Seams (`LLMClient`, `Transcriber`) already support it; only `baseURL`/`model` config changes.
- **Badge catalog / quests / richer gamification** — expand beyond the 5 current milestone achievements.
- **Dedicated exam/level-check mode** — a short mixed 4-skill check that re-estimates CEFR and snapshots progress.
- **Conversation/speaking-practice free dialogue mode** — open-ended spoken exchange with the LLM.
- **`skipValidation` option on `generateContent`** — make the intent of `NullContentValidator` explicit at the design level rather than a local class.
