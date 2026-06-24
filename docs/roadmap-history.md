# Roadmap History — Lang-Tutor

> Complete record of the v1 build phases. All phases are done.
> Open items and future roadmap live in `docs/decisions.md` and GitHub issues.

## Build order rationale

Phase 0 before all (seams + shell). Within it, agent docs and skills come right after scaffolding
so every later step inherits the conventions. Phase 1 before 2 (SRS/placement need lexicon + CEFR
data). Phase 2 is the first shippable app. Phases 3–6 each add one skill and reuse the same
pipeline/diagnostics. Phase 7 needs events from 3–6 to be meaningful. Phase 8 hardens.
Diagnostics and gamification are threaded through 2–6, not bolted on at the end.

---

## Phase 0 — Foundation & seams ✅

**What shipped:**

- Next.js 16 + React 19 + Turbopack + TS strict + Tailwind v4 + ESLint/Prettier scaffold
- `AGENTS.md` / `CLAUDE.md` / `.claude/skills/` / `.claude/settings.json`
- `ui/` wrappers over Base UI (Button, Dialog, Tooltip, Popover, Tabs, Input, Card, Progress)
- Dexie schema for all tables + `ContentRepository` seam + Vitest with `fake-indexeddb`
- `LLMClient` seam + Vercel AI SDK → Ollama proxy + `MockLLMClient` for tests
- Settings page: Mac endpoint override persisted to IndexedDB **and** server-held runtime override via `POST /api/llm/config`
- Serwist PWA via `@serwist/turbopack` (SW compiled by esbuild inside `app/serwist/[path]/route.ts`)
- Playwright e2e harness; `pnpm verify` = typecheck + lint + format + unit tests

**Key decisions made:**

- Composition root split: `lib/registry.ts` (client-safe) + `lib/llm/server.ts` (server-only). Dynamic `import()` alone does not keep `server-only` out of the client graph.
- Same-origin CSRF guard (`lib/server/origin.ts`) on all state-changing POSTs.
- Proxy hardening: upstream errors redacted; request sizes capped (chat ≤64 msgs ×20k chars, embeddings ≤256 ×10k).
- Accepted residual SSRF risk (single-user/local/no-auth model); revisit on any multi-user/cloud move.
- Semantic status tokens: `bg-success`/`bg-warning`/`bg-danger` defined in `app/globals.css`.

---

## Phase 1 — Data backbone & content infrastructure ✅

**What shipped:**

- WordNet subset bundled in `data/wordnet.json` (generated via `scripts/build-wordnet.mjs`)
- Words-CEFR-Dataset bundled in `data/words-cefr.json` (generated via `scripts/build-words-cefr.mjs`)
- `LexiconProvider` seam + `LocalLexiconProvider` (bundled data + Free Dictionary API for audio, cached to `lexiconCache`)
- `data/grammar-map.json` — 39-entry A1–C2 grammar construction map, Zod-validated at module load
- `LocalContentValidator` (`validate(text, targetCefr)`) with pre-compiled regex markers
- `LLMClient.embed` via Ollama embedding model; cosine-similarity search helper
- `generateContent<T>()` pipeline (generate → validate → corrective retry → cache)
- Starter seed: 8 passages (A1×2/A2×2/B1×2/B2×2) + 20 cards in `lib/content/seed.ts`

**Key decisions made:**

- `lib/lexicon/server.ts` is server-only (`getLexiconProvider()`); audio caching omitted on server (IndexedDB is browser-only).
- `loadSeedIfEmpty` idempotency guards on exact count (not `> 0`) so a partial-load failure is retried.
- Pipeline corrective-retry sends `JSON.stringify(parsed)` in the assistant turn (not just the raw text field).

---

## Phase 2 — Onboarding + Vocabulary SRS ✅

**What shipped:**

- Placement quiz: adaptive vocab yes/no + pseudowords → CEFR estimate → `profile.cefrLevel`
- Goals capture (`/onboarding/goals`); "onboarded" ⇔ `profile.cefrLevel` set
- `lib/srs/` FSRS wrapper (`initCard`, `scheduleCard`, `getDueCards`, `isDue`) over `ts-fsrs` v5.4.1
- Review session UI (`/review`) with `ratingInFlight` guard and `try/catch` → error phase
- Add-to-deck (`lib/deck/` + `GET /api/lexicon/lookup`)
- `lib/gamification/` pure functions: `earnXp`, `xpToLevel`, `updateStreak`, `applyReview`; 5 achievements (`first_review`, `xp_50`, `xp_200`, `streak_3`, `streak_7`)
- `GamificationHud` in layout header; re-fetches on `usePathname` change

**Key decisions made:**

- `localDateString(date)` uses `getFullYear/Month/Date` (not `.toISOString()`) to avoid streak recording wrong day in UTC− timezones.

---

## Phase 3 — Reading module ✅

**What shipped:**

- Topic picker + passage generation + library (`/reading`)
- Passage reader with tap-to-define (offline-first: cache → bundle → network → `PUT /api/lexicon/define`)
- Tap-to-add to SRS from the word popover
- Comprehension quiz + diagnostics (`createReadingErrorEvent`, `lib/diagnostics/reading.ts`)
- Runtime enrichment agent (`lib/agent/research-word.ts`, `POST /api/agent/research-word`)

**Key decisions made:**

- `OllamaLLMClient.chat()` uses `generateText` + `extractJson()` (not `generateObject`) for compatibility with LM Studio and Ollama builds that reject `response_format:json_object`.
- Pipeline `llmClient.chat()` wrapped in `try/catch`; `SyntaxError`/`ZodError` on non-final attempt → `continue` (retry) rather than propagate.
- `GET /api/lexicon/define` word param capped at 100 chars; `encodeURIComponent` prevents path injection.

---

## Phase 4 — Writing module ✅

**What shipped:**

- Writing prompts: 12-prompt seed (A1–C2) + generator + picker (`/writing`)
- Structured feedback: `FeedbackSchema` (overallScore, structuralGrade, corrections[]) + `POST /api/writing/feedback` + revision loop
- Writing diagnostics: `createWritingErrorEvents` (corrections → `errorEvents`)

**Key decisions made:**

- `NullContentValidator` (always `{ ok: true }`) used locally in `POST /api/writing/generate` — writing prompts are teacher-voice; CEFR gating intentionally bypassed.
- `NullContentRepository` duplicated in reading + writing generate routes — see technical debt issues.
- `ContentValidator` interface type (not `LocalContentValidator` concrete) used for `_validator` in route handlers — Rule 2 compliant.

---

## Phase 5 — Listening module ✅

**What shipped:**

- TTS playback: `lib/tts/speech-synthesis.ts` + `ui/tts-button.tsx` (Play/Stop toggle) on reading, writing, and listening pages
- Dictation + WER: `lib/diagnostics/wer.ts` (Levenshtein DP), `WerDisplay` UI, `createListeningErrorEvents`
- Listening comprehension quiz reusing `POST /api/reading/questions`; events tagged `skill:"listening"`
- Listening library at `/listening` (queries `type:"passage"` from IndexedDB)

---

## Phase 6 — Speaking module ✅

**What shipped:**

- Mic capture: `lib/audio/normalize.ts` (toMono, resample to 16 kHz, encodeWav) + `workers/audio-normalize.ts` Web Worker + `lib/audio/use-recorder.ts`
- `Transcriber` seam: `interface Transcriber { transcribe(audio: Blob): Promise<string> }` + `WhisperTranscriber` (server-only, POSTs to whisper.cpp `/inference`) + `MockTranscriber`
- `POST /api/stt/transcribe`: origin-guarded, 10 MB size cap, `audio/*` MIME check, 502 on Mac unavailable
- Speaking module (`/speaking`): passage library → pronunciation scoring (WER, `createSpeakingErrorEvents`)
- `lib/diagnostics/wer-error-events.ts`: shared `createWerErrorEvents(alignment, skill, cefr, now?)` helper

**Key decisions made:**

- LM Studio cannot replace whisper.cpp for STT (no audio endpoint). See `docs/whisper-mac-setup.md`.
- `workers/audio-normalize.ts` uses options-object form `self.postMessage(wav, { transfer: [wav] })` to avoid TypeScript `Window.postMessage` overload conflict.

---

## Phase 7 — Weakness engine + diagnostics + adaptive selection ✅

**What shipped:**

- `computeWeaknesses(events, now)`: exponential decay, 30-day half-life; `score = W/(W+5)`, `confidence = min(1, W/10)`
- Diagnostics page (`/diagnostics`): skill tabs, heatmap (category × CEFR), mastery tiers (struggling ≥60% / developing 30–59% / mastering <30%), drill-down (up to 5 recent contexts)
- `rankTopicsByWeakness` + `topicWeaknessScore` (max-per-category dedup) + ★ badge on top-3 topics in reading/writing pickers

**Key decisions made:**

- `topicWeaknessScore` uses max-per-category (not sum-all) to prevent "vocabulary" at 6 CEFR levels from inflating scores ~6×.
- Skill filter: only own-skill weaknesses drive topic ranking (prevents cross-skill contamination).
- WER categories (`"substitution"|"deletion"|"insertion"`) don't match reading/writing affinity keywords — correct after skill filter fix.

---

## Phase 8 — Polish & hardening ✅

**What shipped:**

- Serwist offline strategies tuned; `tests/e2e/offline.spec.ts` Playwright offline matrix
- JSON backup/restore: `BackupSchema` (Zod, v1, `z.coerce.date()`), `exportBackup`/`importBackup`, `app/settings/backup-section.tsx`
- Settings completeness: utility model, STT URL, TTS accent/lang; `POST /api/stt/config` + `GET /api/stt/health`; `app/settings-bootstrap.tsx` pushes both LLM + STT config in parallel on load
- Framer Motion 12: page transitions (`app/page-transition.tsx`), card animations, skeleton loaders (`ui/skeleton.tsx`)
- Dexie v2 compound indexes (`[type+level]`, `[skill+cefr]`); `next/dynamic({ssr:false})` lazy routes; `POST /api/llm/warmup` warm-up ping
- `localDateString(date)` timezone fix; achievement icons (`AchievementDef.icon`); 308 total unit tests

**Key decisions made:**

- `POST /api/stt/config` and `GET /api/stt/health` follow the same origin-guard + accepted-SSRF pattern as `POST /api/llm/config`.
- `GET /api/stt/health` leaks Node fetch error message — accepted under single-user/local threat model.
- `handleSave` (settings) uses `Promise.all([pushLlm, pushStt])` so STT override is always pushed even if LLM push throws.
- `URL.revokeObjectURL` moved into `setTimeout(..., 100)` to avoid Firefox/Safari race in backup section.
