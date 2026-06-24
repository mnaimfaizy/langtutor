# AGENTS.md — Lang-Tutor

> Canonical guide for any coding agent (or human) working in this repo.
> **Source of truth for the roadmap is `PLAN.md`.** This file is the day-to-day operating manual;
> where the two overlap, PLAN.md §1 (locked decisions) wins. Keep this file current — it is
> updated at every phase close-out (PLAN.md §3.5). Stale agent docs are worse than none.

## Project frame

Lang-Tutor is a **single-user, local-first, gamified English-learning PWA** (content reaches
A1–C2). The UI is a Next.js app that runs locally on the user's laptop. Live AI (chat,
embeddings, and later Whisper STT) runs on the user's home Mac via Ollama (OpenAI-compatible API)
and is reached **only** from server route handlers over LAN/Tailscale. Everything is built behind
swappable **seams** so the app can later move to the cloud by changing config, not code. All
learner data and cached content live in IndexedDB (Dexie). No auth, no backend, no sync (yet).

## Current phase / next step

- **Phase 0 — Foundation & seams — ✅ complete** (all 8 steps + the §3.5 close-out).
- **Phase 1 — Data backbone & content infrastructure — ✅ complete** (all 8 steps + `/code-review` + `/security-review`).
- **Phase 2 — Onboarding + Vocabulary SRS — ✅ complete** (all 6 steps + `/code-review` + top-3 review fixes).
- **Phase 3 — Reading module — ✅ complete** (all 5 steps + `/code-review` + `/security-review` + close-out fixes).
- Done (Phase 3): **3.1** Topic → passage generation · **3.2** Tap-to-define word popover · **3.3** Tap-to-add to SRS · **3.4** Comprehension quiz + diagnostics · **3.5** Runtime enrichment agent.
- **Phase 4 — Writing module — ✅ complete** (all 3 steps + `/code-review` + `/security-review` + close-out fixes).
- Done (Phase 4): **4.1** Writing prompts: seed (12 prompts A1–C2) + generator + picker · **4.2** Structured feedback: Zod schema, API route, feedback UI + revision loop · **4.3** Writing diagnostics: corrections → `errorEvents`.
- **Phase 5 — Listening module — ✅ complete** (all 3 steps + `/code-review` + `/security-review` + close-out fixes).
- Done (Phase 5): **5.1** TTS playback: `SpeechSynthesis` wrapper, configurable rate + voice, Listen button on reading/writing/listening pages · **5.2** Dictation + WER: Levenshtein word-level scoring, alignment diff UI, `errorEvents` (skill:"listening") · **5.3** Listening comprehension: quiz on dictation page reusing `/api/reading/questions`, `errorEvents` tagged skill:"listening".
- **Phase 6 — Speaking module — ✅ complete** (all 3 steps + `/code-review` + `/security-review` + close-out fixes).
- Done (Phase 6): **6.1** Mic capture + 16 kHz mono WAV normalization (Web Worker) · **6.2** `Transcriber` seam + `MockTranscriber` + `POST /api/stt/transcribe` proxy · **6.3** Pronunciation scoring: passage library, `speaking-view.tsx`, WER alignment diff, `createSpeakingErrorEvents` → IndexedDB.
- **Phase 7 — Weakness engine + diagnostics + adaptive selection — ✅ complete** (all 3 steps + `/code-review` + close-out fixes).
- Done (Phase 7): **7.1** Weakness engine: `computeWeaknesses` (exponential decay, 30-day half-life) · **7.2** Diagnostics page: heatmap + skill tabs + drill-down panel · **7.3** Adaptive selection: `rankTopicsByWeakness` + ★ badge on reading/writing topic pickers.
- **Phase 8 — Polish & hardening — ✅ complete** (all 6 steps + `/code-review` + `/security-review` + close-out fixes).
- Done (Phase 8): **8.1** Offline/caching polish (Serwist strategies, offline matrix) · **8.2** Backup: JSON export/import, round-trip restore · **8.3** Settings completeness: utility model, STT URL, TTS accent/lang, runtime overrides · **8.4** UX motion: Framer Motion page transitions, card animations, skeleton loaders · **8.5** Performance: Dexie v2 compound indexes, lazy routes (`next/dynamic ssr:false`), LLM warm-up ping, best-effort embed-on-generate · **8.6** Gamification final pass: `localDateString` timezone fix, achievement icons/copy, date-edge Vitest tests.
- **Next: Phase 9** — (refer to PLAN.md for upcoming roadmap).
- **Phase 8 close-out notes:**
  - **Offline polish (8.1):** Serwist strategies tuned per §2.2; `tests/e2e/offline.spec.ts` Playwright offline matrix verifies all "offline ✅" pages.
  - **Backup (8.2):** `lib/backup/schema.ts` — `BackupSchema` (Zod, version:1, `z.coerce.date()` on all date fields). `DexieContentRepository.exportBackup/importBackup` — `importBackup` clears all tables then `bulkPut`s with inbound keys. `app/settings/backup-section.tsx` — export (Blob download) + import (hidden file input). Tests: `tests/backup/backup.test.ts` (round-trip, date coercion). E2e: `tests/e2e/backup.spec.ts`.
  - **Settings completeness (8.3):** `lib/db/schema.ts` — `ProfileSettings` gains `ttsLang?: string`. `lib/llm/settings.ts` — `LLMOverridesSchema` gains `utilityModel`; `resolveLLMConfig` + `settingsToOverrides` updated. `lib/transcriber/runtime-config.ts` (NEW, `server-only`) — process-scoped `overrideUrl` for STT URL, mirroring `lib/llm/runtime-config.ts`. `app/api/stt/config/route.ts` (NEW) — origin-guarded POST; `SttConfigSchema = z.object({ sttUrl: z.url().max(2048).optional() })`; accepted-SSRF-risk note. `app/api/stt/health/route.ts` (NEW) — GET; probes `${base}/health` with 5 s timeout. `app/settings-bootstrap.tsx` — `Promise.all([pushLlm, pushStt])` (parallel, not sequential) then warm-up fire-and-forget. Settings page gains utility model, STT URL, TTS accent fields; `SttHealthSchema = z.object(...)` (Zod, Rule 3); `handleTestStt` has its own `sttBusy` state; `handleSave` uses `Promise.all` for both config pushes.
  - **UX motion (8.4):** Framer Motion 12 added. `app/page-transition.tsx` — 150 ms opacity fade, `mode="wait"`, keyed to `usePathname`. `ui/skeleton.tsx` — `bg-foreground/8 animate-pulse` component; exported from `ui/index.ts`. `app/review/review-session.tsx` — skeleton loading state, card slide animation (`x: ±40`), definition fade, progress bar motion, summary scale-in, XP spring bounce, achievement stagger.
  - **Performance (8.5):** `lib/db/database.ts` v2 — compound indexes `[type+level]` on content, `[skill+cefr]` on errorEvents. `DexieContentRepository.queryContent/queryErrorEvents` use indexed queries (type+level or type-only or level-only or full scan). `lib/content/pipeline.ts` gains `embed?: boolean` — best-effort vector storage after validation. `app/api/llm/warmup/route.ts` (NEW) — origin-guarded POST; fires `client.chat(["ping"])` to pre-load model. `app/review/review-loader.tsx` + `app/diagnostics/diagnostics-loader.tsx` — `next/dynamic({ ssr: false })` lazy loaders with skeleton fallbacks.
  - **Gamification final pass (8.6):** `lib/gamification/streak.ts` — `localDateString(date: Date): string` exported; uses local `getFullYear/Month/Date` (not `.toISOString()`) to avoid streak recording wrong day in UTC− timezones. `lib/gamification/achievements.ts` — `AchievementDef` gains `icon: string`; all 5 defs have emoji icons. `app/review/review-session.tsx` — achievement display shows `{icon} {label} unlocked!` via `ACH_DEF_MAP`. 11 new tests (308 total).
  - **Code-review fixes (8 close-out):** (1) `handleSave` (settings) — switched from sequential LLM/STT config pushes to `Promise.all(...)` so STT override is always pushed even if LLM push throws. (2) `SttHealthSchema` — replaced hand-rolled validator with `z.object({ ok: z.boolean(), error: z.string().optional() })` (Rule 3). (3) `handleTestStt` — given its own `sttBusy` state so Test STT no longer disables the Save and Test LLM buttons. (4) `backup-section.tsx` `URL.revokeObjectURL` — moved into `setTimeout(..., 100)` to avoid Firefox/Safari race where blob URL is revoked before browser reads the data. (5) Range slider — `accent-[var(--color-accent)]` → `accent-accent` (Rule 7).
  - **Security review (8 close-out):** Conditional pass. New routes: `POST /api/stt/config` and `GET /api/stt/health` follow the same origin-guard + accepted-SSRF pattern as `POST /api/llm/config`. `POST /api/llm/warmup` — origin-guarded, no URL input, no SSRF. URL length cap: `z.url().max(2048)` added to `SttConfigSchema.sttUrl` and `LLMOverridesSchema.baseURL`. `lib/transcriber/runtime-config.ts` has `import "server-only"`. Error messages: `GET /api/stt/health` leaks Node fetch error message — accepted under single-user/local threat model. Accepted-risk SSRF comment added to `POST /api/stt/config`.
  - **Deferred (still pending before Phase 9):** `CEFR_COLOR` duplication (10+ copies — extract to `lib/cefr.ts`); `AlignmentToken`/`WerDisplay` component duplication; `SpeakingClient` ≈ `ListeningClient`; `ListeningComprehensionQuiz` ≈ `ComprehensionQuiz`; `NullContentRepository` duplicated in reading + writing generate routes (extract to `lib/content/null-adapters.ts`).
- **Phase 7 close-out notes:**
  - **Weakness engine (7.1):** `lib/diagnostics/weakness.ts` — `computeWeaknesses(events, now)`: groups by `skill|category|cefr` key, decay-weighted sum W with `HALF_LIFE_DAYS=30`; `score = W/(W+5)`, `confidence = min(1, W/10)`. `WeaknessReport` type. Tests: `tests/diagnostics/weakness.test.ts` (15 tests).
  - **Diagnostics page (7.2):** `app/diagnostics/diagnostics-client.tsx` — skill tabs (`role="tablist"`), heatmap table (category × CEFR), mastery tiers: struggling ≥60% (danger), developing 30–59% (warning), mastering <30% (success). Click-to-drill-down shows up to 5 most-recent unique non-empty error contexts. `app/diagnostics/page.tsx`. Home page gains `/diagnostics` link (`data-testid="btn-diagnostics"`). E2e: `tests/e2e/diagnostics.spec.ts`.
  - **Adaptive selection (7.3):** `lib/content/adaptive-selection.ts` — `READING_TOPIC_AFFINITIES`, `WRITING_TOPIC_AFFINITIES` (10 topics each). `topicWeaknessScore`: sums max-per-category scores for matching affinity keywords (case-insensitive substring). `rankTopicsByWeakness`: stable descending sort. `reading-client.tsx` / `writing-client.tsx`: load `errorEvents`, compute weaknesses, filter to own skill, `useMemo` for `suggestedTopics` Set. ★ badge on top-3 topics.
  - **Code-review fixes (7 close-out):** (1) `topicWeaknessScore` — changed from sum-all to max-per-category dedup, preventing "vocabulary" at 6 CEFR levels from inflating scores ~6×. (2) `reading-client.tsx` + `writing-client.tsx` — skill filter added: only own-skill weaknesses drive topic ranking (prevents cross-skill contamination). (3) `reading-client.tsx` + `writing-client.tsx` — `suggestedTopics` wrapped in `useMemo([weaknesses])` to avoid re-sorting on every keystroke. (4) `diagnostics-client.tsx` `selectedContexts` — empty-string contexts filtered out (`e.context &&`) to prevent blank drill-down entries. (5) `diagnostics-client.tsx` legend — "Struggling (>60%)" corrected to "Struggling (≥60%)" to match `>= 0.6` code boundary. (6) `TranscribeResponseSchema` extracted to shared `app/speaking/transcribe-schema.ts`; both `speaking-view.tsx` and `recorder-view.tsx` import from it.
  - **No `/security-review`:** Phase 7 touched no proxy/network/storage/audio capture routes.
  - **WER categories note:** `createWerErrorEvents` stores alignment token type (`"substitution"|"deletion"|"insertion"`) as `category`. These don't match reading/writing affinity keywords, but after the skill filter fix that's correct — listening/speaking WER events don't participate in reading/writing topic ranking. The categories remain meaningful in the diagnostics heatmap for their own skill.
  - **Deferred (still pending before Phase 9):** `CEFR_COLOR` duplication (10+ copies — extract to `lib/cefr.ts`); `AlignmentToken`/`WerDisplay` component duplication (`speaking-view.tsx` vs `dictation-view.tsx`); `SpeakingClient` ≈ `ListeningClient`; `ListeningComprehensionQuiz` ≈ `ComprehensionQuiz`.
- **Phase 6 close-out notes:**
  - **Audio capture (6.1):** `lib/audio/normalize.ts` — pure `toMono`, `resample` (linear interpolation, 44.1/48 kHz → 16 kHz), `encodeWav` (44-byte RIFF header, 16-bit signed PCM, clipped). `workers/audio-normalize.ts` — Web Worker; receives `{channels, sampleRate}`, returns WAV `ArrayBuffer` via `self.postMessage(wav, { transfer: [wav] })` (options-object form avoids TypeScript `Window.postMessage` overload conflict). `lib/audio/use-recorder.ts` — `"use client"` hook; `MicState = "idle"|"requesting"|"recording"|"processing"|"denied"|"error"`; `AudioContext.decodeAudioData` + per-channel `.slice()` before transfer (owns each ArrayBuffer). Worker path via `new URL("../../workers/audio-normalize.ts", import.meta.url)`.
  - **Transcriber seam (6.2):** `lib/transcriber/transcriber.ts` — `interface Transcriber { transcribe(audio: Blob): Promise<string> }`. `lib/transcriber/whisper-transcriber.ts` (`import "server-only"`) — POSTs to `${baseUrl}/inference` with `file=audio.wav, response_format=json`; network error → `new Error("Mac STT server not reachable", { cause })`; `WhisperResponseSchema = z.object({ text: z.string() })`. `lib/transcriber/mock-transcriber.ts` — `null` constructor arg throws "Mac STT server not reachable". `lib/transcriber/server.ts` (`import "server-only"`) — `getTranscriber()` reads `MAC_STT_URL ?? "http://localhost:8080"`. `app/api/stt/transcribe/route.ts` — origin-guarded; `MAX_AUDIO_BYTES = 10 MB`; MIME type check (`audio/*`); error classification: connection error → 502, other errors → 500.
  - **Speaking module (6.3):** `app/speaking/speaking-client.tsx` — passage library (`type:"passage"`) linking to `/speaking/[id]`. `app/speaking/[id]/speaking-view.tsx` — loads passage from IndexedDB; `passage` state set once in useEffect (parsed via `PassageSchema.safeParse`); guard: empty reference → `"error"` state (no misleading 0% score); `TranscribeResponseSchema = z.object({ transcript: z.string() })` Zod-validates API response; `transcribeInFlight` ref double-submit guard; resets `transcribeState + werResult` on new recording start; `WerDisplay` (pronunciation score = 100-WER%, alignment diff); `createSpeakingErrorEvents` per-event `try/catch`. Route 502 → `"mac-unavailable"` state; `!res.ok` → `"error"` state.
  - **Shared WER error events (6 close-out):** `lib/diagnostics/wer-error-events.ts` — `createWerErrorEvents(alignment, skill, cefr, now?)` shared helper; `createListeningErrorEvents` and `createSpeakingErrorEvents` both delegate to it.
  - **Code-review fixes (6 close-out):** (1) `recorder-view.tsx` — added `transcribeInFlight` ref + `finally` block (double-submit guard; was missing unlike `speaking-view.tsx`). (2) `speaking-view.tsx` — `PassageSchema.safeParse` moved from render body + `handleTranscribe` into `useEffect`; result stored in `passage` state (parse-once). (3) `speaking-view.tsx` — empty reference guard: `if (!passage?.body) { setTranscribeState("error"); return; }` prevents misleading 0% WER when payload is corrupt. (4) `speaking-view.tsx` — `TranscribeResponseSchema.safeParse` replaces bare `as {}` cast on API response (Hard Rule #3). (5) `recorder-view.tsx` — same Zod-parse fix. (6) Route error classification: `isMacDown = error.message === "Mac STT server not reachable"` → 502 only for connection failure; ZodError / non-OK HTTP from whisper.cpp → 500 (so client correctly shows "Transcription failed" rather than "Mac not reachable"). (7) `recorder-view.tsx` — `transcribeState + werResult` reset when Record is pressed (stale results no longer persist across attempts).
  - **Security review (6 close-out):** Conditional pass. SSRF: user supplies no URL — Mac endpoint from `MAC_STT_URL` (server env) only. Size: 10 MB hard cap before forwarding. Origin guard: `isSameOrigin` on POST. MIME check: `audio/*` guard added at close-out. Error leakage: catch block logs server-side; client receives generic message only. Secrets: `lib/transcriber/server.ts` is `server-only`. No path traversal (hardcoded `"file"` field, `"audio.wav"` filename). XSS: transcript/alignment rendered as React text nodes only.
  - **LM Studio STT clarification:** `docs/whisper-mac-setup.md` documents that LM Studio cannot replace whisper.cpp for STT as of mid-2026 (no audio endpoint; whisper models download but don't load). When LM Studio ships STT, only `lib/transcriber/whisper-transcriber.ts` needs changing.
  - **CEFR_COLOR duplication (deferred):** Phase 6 adds 2 more copies (`speaking-view.tsx` uses `Record<string,string>`, `speaking-client.tsx` uses `Record<Cefr,string>`) — total now 10 across the codebase. Extract to `lib/cefr.ts` before Phase 7.
  - **Component duplication (deferred):** `AlignmentToken` + `WerDisplay` in `speaking-view.tsx` are near-copies of those in `dictation-view.tsx` (differ only in score label). `SpeakingClient` is a near-copy of `ListeningClient`. Extract shared components before Phase 7.
  - **`ListeningComprehensionQuiz` duplication (deferred from Phase 5, still pending):** `app/listening/[id]/listening-quiz.tsx` vs `app/reading/[id]/comprehension-quiz.tsx`. Extract before Phase 7.
- **Phase 5 close-out notes:**
  - **TTS (5.1):** `lib/tts/speech-synthesis.ts` — `resolveTtsOptions(opts, voices)`: rate clamped to `[0.1, 10]`, voice matched by `voiceURI`. `ui/tts-button.tsx` — Play/Stop toggle; reads rate+voice from profile settings on mount; `utteranceRef` guards stale utterance events (cancelled utterance's async `error` fires after second `speak()` — guard prevents spurious `setPlaying(false)`). Settings page gains TTS card (rate slider 0.5–2.0, voice `<select>`). `TtsButton` exported from `ui/index.ts`; placed in `passage-view.tsx` and `prompt-view.tsx`.
  - **WER (5.2):** `lib/diagnostics/wer.ts` — `computeWer(reference, hypothesis)`: Levenshtein DP + backtrack (substitution > deletion > insertion priority); returns `{ wer, substitutions, deletions, insertions, alignment }`. Edge cases: both empty → `wer:0`; ref empty, hyp non-empty → `wer:Infinity`. `lib/diagnostics/listening.ts` — `createListeningErrorEvents(alignment, cefr, now?)` maps non-correct tokens to `NewErrorEvent` with `skill:"listening"`. `dictation-view.tsx` (`app/listening/[id]/`) — passage from IndexedDB (shared with reading), TTS button, hidden reference, transcript textarea, `handleCheck` (double-submit guard via `checkInFlight` ref, wrapped in `try/finally`; skips diagnostic writes when `body===""` or `wer===Infinity`), `WerDisplay` (score card + alignment diff + collapsible reference).
  - **Listening comprehension (5.3):** `app/listening/[id]/listening-quiz.tsx` — reuses `POST /api/reading/questions` (already origin-guarded); wrong answers emit `createListeningComprehensionErrorEvent` (`skill:"listening"`, `category` from question, `context` = question text). Rendered below the dictation area in `dictation-view.tsx`.
  - **Listening library (5.2):** `app/listening/listening-client.tsx` + `app/listening/[id]/page.tsx` — queries `type:"passage"` from IndexedDB (same data as reading). `data-testid="passage-library"` / `"library-empty"`.
  - **Code-review fixes (5 close-out):** (1) `tts-button.tsx` — `utteranceRef` guards stale utterance events. (2) `dictation-view.tsx` — `handleCheck` wrapped in `try/finally` to guarantee `checkInFlight.current=false` on any throw. (3) `dictation-view.tsx` — diagnostic writes guarded by `body && isFinite(result.wer)` to prevent false insertion events when `PassageSchema.safeParse` fails.
  - **Security review (5 close-out):** Phase 5 adds no new API routes. TTS uses browser `SpeechSynthesis` (no network I/O). Listening comprehension reuses the already origin-guarded `POST /api/reading/questions`. No secrets in client bundle. Clean.
  - **CEFR_COLOR duplication (deferred):** Phase 5 adds 2 more copies (`dictation-view.tsx` uses `Record<string,string>`, `listening-client.tsx` uses `Record<Cefr,string>`) — total now 8 across the codebase. Extract to `lib/cefr.ts` before Phase 6.
  - **ListeningComprehensionQuiz duplication (deferred):** `app/listening/[id]/listening-quiz.tsx` is a near-verbatim copy of `app/reading/[id]/comprehension-quiz.tsx` differing only in data-testid prefixes and the diagnostic function. Extract to a shared `<ComprehensionQuiz skill="reading"|"listening">` component before Phase 7.
- **Phase 4 close-out notes:**
  - **Writing prompts (4.1):** `lib/content/prompt.ts` — `PromptSchema`, `WRITING_TOPICS`, `buildPromptMessages(topic, level)`. `POST /api/writing/generate` uses `generateContent()` pipeline with `NullContentRepository` + `NullContentValidator` (prompts are teacher-voice; CEFR gating intentionally bypassed — see seam note below). Client saves to IndexedDB, navigates to `/writing/[id]`. `writing-client.tsx` manages topic picker + level selector + library list. Seed: 12 prompts (2 per level A1–C2) added to `lib/content/seed.ts`.
  - **Seed idempotency fix (4.1 close-out):** `loadSeedIfEmpty` now checks passages, prompts, and cards independently via `Promise.all`. Cards previously bundled with passages are now guarded by a separate `cardsDone = allCards.length >= SEED_CARDS.length` check, fixing a data-loss edge case where passages loaded but cards did not.
  - **`SeedBootstrap` (4.1):** Updated to show `{passages} passages · {prompts} prompts · {cards} cards ready offline`. Queries by type+source to count separately.
  - **Structured feedback (4.2):** `lib/content/feedback.ts` — `CorrectionSchema` (original/corrected/category/explanation, all with string length caps), `FeedbackSchema` (overallScore 0–10 int, structuralGrade as `z.enum(["Excellent","Good","Developing","Needs Work"])`, corrections array `.max(50)`). `POST /api/writing/feedback` — origin-guarded; draft `.max(4000)`; explicit `FeedbackSchema.parse(raw)` at route boundary before returning. `prompt-view.tsx` — `SubmitPhase = "idle"|"submitting"|"done"|"error"`; `inFlight` ref double-submit guard; revision loop (Revise resets to idle without clearing draft).
  - **Writing diagnostics (4.3):** `lib/diagnostics/writing.ts` — `createWritingErrorEvents(corrections, cefr, now?)` maps each `Correction` to a `NewErrorEvent` with `skill:"writing"`, `category`, `cefr`, `context = correction.original`. Called in `prompt-view.tsx` after feedback lands; per-event `try/catch` matches reading quiz pattern.
  - **Validator bug fix:** `lib/content/content-validator.ts` — pure-numeric tokens (`/^\d+$/`) now skipped in word-violation detection; numbers are not vocabulary items.
  - **NullContentValidator seam note:** `app/api/writing/generate/route.ts` defines `NullContentValidator` (always `{ ok: true }`) locally — writing prompt instructions are teacher-voice and intentionally bypass word/grammar gating. The pipeline still handles parse-error retries. This pattern is a known limitation; a future `skipValidation` option on `generateContent` would make the intent explicit at the design level.
  - **NullContentRepository duplication:** verbatim 65-line class exists in both `app/api/writing/generate/route.ts` and `app/api/reading/generate/route.ts` — deferred cleanup; extract to `lib/content/null-adapters.ts` before adding a third generate route.
  - **CEFR_COLOR duplication:** `Record<Cefr, string>` mapping copied across 6 files — deferred cleanup; extract to `lib/cefr.ts` or a shared `ui/` helper.
- **Phase 3 close-out notes:**
  - **Passage generation (3.1):** `lib/content/passage.ts` — `PassageSchema`, `READING_TOPICS`, `buildPassageMessages(topic, level)`. `POST /api/reading/generate` uses `generateContent()` pipeline with `NullContentRepository` (server has no Dexie); client saves result to IndexedDB and navigates to `/reading/[id]`. `reading-client.tsx` manages topic/level picker + library list.
  - **LLM client compatibility fix:** `OllamaLLMClient.chat()` switched from `generateObject` → `generateText` + `extractJson()` for compatibility with LM Studio and Ollama builds that reject `response_format:json_object`. `extractJson` handles raw JSON, markdown fences, and embedded `{…}` blocks.
  - **Pipeline parse-error retry (close-out fix):** `lib/content/pipeline.ts` — `llmClient.chat()` call is now wrapped in `try/catch`; a `SyntaxError` or `ZodError` on a non-final attempt triggers `continue` (retry with same messages) rather than propagating and bypassing all remaining retries.
  - **Tap-to-define (3.2):** `app/reading/[id]/word-popover.tsx` — `LookupState` union; offline-first cache via `repo.getLexiconEntry` → `PUT /api/lexicon/define` → `repo.putLexiconEntry`. `ui/popover.tsx` gains `PopoverInlineTrigger` (inline word-style, no button chrome).
  - **Tap-to-add (3.3):** `AddToDeckButton` inside `WordPopover`; `AddState = "idle"|"adding"|"added"|"duplicate"|"error"`. Reuses `buildNewCard`/`isDuplicate` from `lib/deck`. `cefr ?? "B1"` fallback for nullable CEFR. `researchingRef` guard added at close-out to prevent double-tap on the Research button.
  - **Comprehension quiz (3.4):** `app/reading/[id]/comprehension-quiz.tsx` — phases `idle|loading|answering|result|error`. `handleSubmit` wrapped in `try/catch` so UI always reaches `result` phase even if an IndexedDB write fails. `lib/content/comprehension.ts` — `ComprehensionQuestionSchema`, `ComprehensionQsSchema`, `buildQuestionsMessages`. `POST /api/reading/questions` (origin-guarded, `body.max(8000)`).
  - **Diagnostics (3.4):** `lib/diagnostics/reading.ts` — `createReadingErrorEvent({ question, category, cefr, now? })` → `NewErrorEvent` with `skill:"reading"`, question text as `context`. `lib/diagnostics/index.ts` re-exports it.
  - **Runtime enrichment agent (3.5):** `lib/agent/research-word.ts` (server-only) — `researchWord(word, llmClient)` with tolerant `AgentWordSchema` (definition: string|string[]→string with min(1); pos: "noun"→"n" map; cefr: regex extract from verbose strings). `POST /api/agent/research-word` returns `DefineFound` shape; 502 on Mac unavailable. `WordPopover` gains `researching` + `offline` states.
  - **`GET /api/lexicon/define`** — word param capped at 100 chars (close-out security fix). Calls Free Dictionary API for phonetic/audioUrl; `encodeURIComponent` prevents path injection.
  - **Seam note:** `app/api/reading/generate/route.ts` uses `ContentValidator` interface type (not `LocalContentValidator` concrete) for `_validator` and `getValidator()` return type — Rule 2 compliant.
- **Phase 2 close-out notes:**
  - **SRS (2.3):** `lib/srs/` — `initCard(now)`, `scheduleCard(fsrs, rating, now)`, `getDueCards(cards, now)`, `isDue(fsrs, now)`. `SrsRating = "again" | "hard" | "good" | "easy"`. Wraps `ts-fsrs` v5.4.1; `FsrsState.learningSteps` optional (defaults to 0 for old cards).
  - **Placement quiz (2.1):** `lib/placement/quiz-engine.ts` — `buildQuizBatch(level)`, `shouldAdvance(answers)`, `scoreQuiz(answers)`. Word list in `lib/placement/word-list.ts`; pseudowords baked in. `CEFR_ORDER` exported for shared level ordering. Word order is deterministic — shuffle in `buildQuizBatch` is a Phase 3+ improvement.
  - **Review session (2.4):** `app/review/review-session.tsx` — phases `loading | empty | reviewing | summary | error`. `handleRate` protected by `ratingInFlight` ref (double-tap guard) and `try/catch` → `"error"` phase with retry button. `applyReview` called on session completion; result shown in summary (+XP, level-up, achievements).
  - **Add-to-deck (2.5):** `lib/deck/` — `buildNewCard(data, now)`, `isDuplicate(word, existing)`. Lookup API: `GET /api/lexicon/lookup?word=` (200 found/not-found, 400 missing, 503 data not built).
  - **Gamification (2.6):** `lib/gamification/` — `earnXp(n)` (10 XP/card), `xpToLevel(xp)` (non-linear thresholds), `updateStreak(last, today, count)`, `applyReview(state, {cardCount, today, now})`. 5 achievements: `first_review`, `xp_50`, `xp_200`, `streak_3`, `streak_7`. `GamificationHud` in layout header; re-fetches on `usePathname` change.
  - **Streak date note:** `today` in `handleRate` uses `now.toISOString().slice(0,10)` (UTC). Both writer and reader (`dayBefore` in streak.ts) use UTC consistently, so behavior is self-consistent but may misalign with local midnight in UTC− timezones. A future fix: use `Intl.DateTimeFormat` for local-date strings.
  - **Onboarding flow:** quiz → `/onboarding/goals` → home. "Onboarded" ⇔ `profile.cefrLevel` set. Nav links on home page (Review / Add words) are accessible before onboarding — by design for MVP; add a redirect guard in Phase 3 if needed.
  - **`answeringRef` guard (2.1):** `handleAnswer` in `placement-quiz.tsx` uses a `useRef` flag to prevent double-tap from firing twice before React re-renders.
- **Phase 1 close-out notes:**
  - `lib/lexicon/server.ts` — server-only `getLexiconProvider()` (mirrors `lib/llm/server.ts`). Audio caching **omitted** on the server (`repo: null`) — IndexedDB is browser-only. Client-side audio caching wired in Phase 3.2.
  - `lib/lexicon/data-loader.ts` — `readFileSync` with a dev-friendly ENOENT message pointing to build scripts.
  - `data/grammar-map.json` Zod-validated at module load — authoring typos surface at startup.
  - `LocalContentValidator` pre-compiles regex markers in the constructor.
  - Pipeline corrective-retry sends `JSON.stringify(parsed)` (not just the text field).
  - **Generated data files** (`data/wordnet.json`, `data/words-cefr.json`) are **gitignored**. Fresh-checkout setup: `pnpm install && node scripts/build-wordnet.mjs && node scripts/build-words-cefr.mjs` (CEFR script needs internet).
  - **Starter seed (1.8):** `lib/content/seed.ts` — 8 passages (A1×2/A2×2/B1×2/B2×2) + 20 cards (5/level A1–B2); `loadSeedIfEmpty(repo)` idempotency guards on `passages.length >= SEED_PASSAGE_COUNT` (not `> 0`) so a partial-load failure is retried. `SeedBootstrap` client component loads seed on mount; `data-testid="seed-ready"` bar visible after load.
- **Status tokens** (added in the 0.8 close-out): use `bg-success`/`text-success`, `bg-warning`, `bg-danger`/`text-danger` for state colors — never raw palette utilities (hard rule #7). Defined in `app/globals.css` (light + dark).
- **Proxy hardening** (0.8 close-out): `app/api/llm/*` redact upstream errors and cap request sizes. Residual SSRF/CSRF accepted under single-user/local/no-auth model; revisit on any multi-user/cloud move.
- **PWA (0.7):** Serwist via **`@serwist/turbopack`** — the SW (`app/sw.ts`) is compiled by **esbuild inside `app/serwist/[path]/route.ts`**, served at `/serwist/sw.js`, registered by `SerwistProvider`. Manifest: `app/manifest.ts`; offline fallback: `app/~offline`; regen icons: `node scripts/generate-icons.mjs`.
- **Composition roots (split by environment):** `lib/registry.ts` is **client-safe** (`getContentRepository`); `lib/llm/server.ts` is **server-only** (`getLLMClient`); `lib/lexicon/server.ts` is **server-only** (`getLexiconProvider`). Dynamic `import()` does **not** keep `server-only` out of the client graph — splitting does.
- **LLM access:** server-only `OllamaLLMClient` (Vercel AI SDK → Ollama) behind `getLLMClient()` (`lib/llm/server.ts`), reached **only** via `app/api/llm/{chat,embeddings,health}`. Mac endpoint/models from server env — copy `.env.example` → `.env.local`. `MockLLMClient` backs offline tests.
- **Runtime config (0.6):** Settings persist Mac endpoint/models to `profile.settings` (IndexedDB) **and** push to a server-held override via `POST /api/llm/config`. Connectivity indicator polls `/api/llm/health`. State-changing POSTs are origin-guarded (`lib/server/origin.ts`). "Onboarded" ⇔ `profile.cefrLevel` is set.
- Base UI ships as **`@base-ui/react`**; all usage is wrapped in `ui/`.
- **Test harness (0.8):** Vitest (node + `fake-indexeddb`) in `tests/**/*.test.ts`; Playwright e2e in `tests/e2e/**/*.spec.ts`. `pnpm verify` = typecheck + lint + format + unit tests. `pnpm test:e2e` is separate. Fresh machines need `pnpm exec playwright install chromium`.

## Commands

| Command                             | What it does                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`                          | Dev server (Turbopack) at http://localhost:3000                                   |
| `pnpm build`                        | Production build (Turbopack)                                                      |
| `pnpm start`                        | Serve the production build                                                        |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (flat config)                                                              |
| `pnpm typecheck`                    | `tsc --noEmit`                                                                    |
| `pnpm format` / `pnpm format:check` | Prettier (+ Tailwind class sort)                                                  |
| `pnpm test` / `pnpm test:watch`     | Vitest (unit; node env + `fake-indexeddb`)                                        |
| `pnpm test:e2e`                     | Playwright e2e (chromium; auto-starts the dev server)                             |
| `pnpm verify`                       | typecheck + lint + format:check + **unit** tests (CI-style gate; e2e is separate) |
| `node scripts/build-wordnet.mjs`    | Generate `data/wordnet.json` (~40 MB; needs `wordpos` devDep installed)           |
| `node scripts/build-words-cefr.mjs` | Generate `data/words-cefr.json` (~3 MB; needs internet)                           |

## Architecture (detail in PLAN.md §2)

- **Topology:** Browser → (same-origin) Next.js app → server route handlers (`app/api/*`) → Mac.
  The browser never calls the Mac directly (mixed-content/CORS + keeps the endpoint server-side).
- **Seams (PLAN.md §2.3):** `LLMClient`, `LexiconProvider`, `ContentRepository`, `Transcriber`,
  `ContentValidator`. Feature code imports the **interface**; concretes are wired in
  `lib/registry.ts` (client-safe) or the seam's own `server.ts` (server-only). See the
  `seam-discipline` skill.
- **Pipeline:** `lib/content/pipeline.ts` `generateContent<T>(opts, llmClient, validator, repo)`
  implements PLAN §2.4: chat(schema) → ContentValidator.validate → corrective retry (with
  `JSON.stringify(parsed)` in the assistant turn) → `ContentRepository.putContent` → return.
- **`lib/content/` module:** `grammar-map.ts` (39-entry A1–C2 map, Zod-validated at load) ·
  `content-validator.ts` (`LocalContentValidator` with pre-compiled markers) ·
  `embeddings.ts` (`cosineSimilarity`, `findNearest`) · `pipeline.ts`.
- **`lib/lexicon/` module:** `wordnet-query.ts` / `cefr-lookup.ts` (pure fns, data injected) ·
  `lexicon-provider.ts` (interface) · `local-lexicon-provider.ts` (impl; `repo: null` on server)
  · `data-loader.ts` (server-only fs loader) · `server.ts` (server-only singleton).

## Hard rules

1. **No client → Mac calls.** Only `app/api/*` route handlers talk to the Mac.
2. **Import seam interfaces, never concretes.** Wire concretes in `lib/registry.ts`.
3. **Zod-parse every LLM / agent / external output** before use.
4. **TypeScript strict; no `any`** in committed code.
5. **Server Components by default;** `"use client"` only where interactivity requires it.
6. **No feature code imports Base UI directly** — go through `ui/` wrappers.
7. **Use Tailwind theme tokens** (`bg-background`, `text-foreground`, …); support light + dark.
8. **Secrets/endpoints server-only** (`.env.local` / `profile.settings`), never in client bundles.
9. **Commit only when the user asks.**

## Repo layout (target — PLAN.md §3.1)

```
app/        Next.js App Router. app/api/* = the ONLY callers of the Mac.
lib/        Seams + pure logic (llm, lexicon, content, srs, diagnostics,
            gamification, db, agent) + registry.ts (composition root).
ui/         Our component layer wrapping Base UI.
data/       Bundled datasets (WordNet, Words-CEFR, grammar map, seed).
workers/    Web workers (WER, audio normalize).
tests/      Vitest unit + Playwright e2e.
.claude/    skills/ (implement-plan-step, seam-discipline, stack-conventions) + settings.json.
```

(`app/` + `app/api/llm` + `app/settings` + PWA files (`app/sw.ts`, `app/serwist`, `app/~offline`, `app/manifest.ts`), `ui/`, `lib/db` + `lib/llm` + `lib/server` + `lib/registry.ts`, `public/icons`, `scripts/`, and `tests/` exist today; the rest land as their phases arrive.)

## Definition of Done (every step — PLAN.md §3.3)

Code compiles & lints clean · the step's **Accept** criteria pass · its **Verify** passes (named
test green or manual checklist ticked) · no regression in existing suites · the **per-phase
close-out (§3.5)** is honored at phase boundaries.

## How to work a step

Use the **`implement-plan-step`** skill: read the step's Build/Accept/Verify/Dep → tests-first for
pure logic → implement behind the seam → `pnpm verify` + the step's test → report with evidence.
At a phase boundary, run the §3.5 close-out (incl. `/code-review`, and `/security-review` for
proxy/network/storage/audio changes) and update this file's **Current phase / next step**.
