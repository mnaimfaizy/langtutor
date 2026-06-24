# Architecture — Lang-Tutor

> Locked decisions and system design for the lang-tutor PWA.
> Where this file and `AGENTS.md` conflict, the Hard Rules in `AGENTS.md` win.

## 1. Locked decisions (source of truth)

| #   | Decision             | Locked choice                                                                                                                                                                                                                             | Why it matters downstream                                                                         |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | **Scope**            | Single-user, local-first. IndexedDB only. **No** auth / Supabase / sync / RLS / WebSockets. One primary device + JSON export/import backup.                                                                                               | Deletes the entire "Backend Strategy" section of the original guide.                              |
| 2   | **Learner**          | Generic **A1–C2**. Onboarding = adaptive **vocab yes/no** placement (+ pseudowords) → CEFR estimate; level self-refines with use. UI in English only.                                                                                     | Placement needs no LLM; runs offline from bundled data.                                           |
| 3   | **Offline model**    | **Bundled open-data backbone** always offline. Dynamic content (passages, quizzes, feedback) is **generate-and-cache**. Ship a **tiny starter seed** (a few passages + a starter vocab deck per level).                                   | "Offline-first" = backbone + already-generated content; _new_ generation needs the Mac reachable. |
| 4   | **AI infra**         | Local models on the Mac via **Ollama** (OpenAI-compatible API), behind **one `LLMClient` seam** (`baseURL`/`model`/`apiKey`). **No** in-browser WebLLM/WebGPU.                                                                            | "Switch to cloud later" = edit config.                                                            |
| 5   | **Model roster**     | Primary **~14B** (Qwen2.5-14B-Instruct class) · utility **~7B** · **embedding** model (nomic-embed-text / bge-m3) · **Whisper** (whisper.cpp / faster-whisper). All swappable.                                                            | 48 GB M4 Pro runs primary + utility + embedding concurrently with headroom.                       |
| 6   | **Topology**         | Next.js app runs **locally on the laptop** (`localhost`, **no Vercel**). Models on the Mac. Linked via **LAN at home / Tailscale away**. Browser → Next server (same origin) → **server-side proxy** → Mac.                               | Avoids CORS + HTTPS→HTTP mixed-content. Keeps the LLM endpoint server-side.                       |
| 7   | **MVP scope**        | **Full four skills** (reading, writing, listening, speaking) + vocab SRS + continuous diagnostics/heatmap + light gamification.                                                                                                           | Usable app at the end of Phase 2; each later phase adds one capability.                           |
| 8   | **Data sources**     | Free/open, **bundled offline**: **WordNet** · **Free Dictionary API / Wiktionary** · **Words-CEFR-Dataset** · our **own CEFR grammar map**. All behind a `LexiconProvider` seam. Oxford/WordsAPI/Cambridge **dropped** (paid/restricted). | License-clean, $0, offline-native.                                                                |
| 9   | **Enrichment agent** | **Runtime on-demand only**: gap + online → research (local model) → **validate** → display → **cache** to IndexedDB.                                                                                                                      | First encounter online; offline forever after.                                                    |
| 10  | **SRS**              | **FSRS** via `ts-fsrs` (ratings: Again/Hard/Good/Easy). **Not** SM2/DolphinSR.                                                                                                                                                            | Fewer reviews for the same retention; self-tuning.                                                |
| 11  | **UI layer**         | **Base UI** primitives + **Tailwind v4**, wrapped behind our **own `ui/` component layer** so the primitive lib is swappable.                                                                                                             | Neutralizes Base UI's youth/bleeding-edge risk.                                                   |
| 12  | **Testing**          | **Targeted**: Vitest for pure logic + Playwright smoke tests + a manual checklist per step.                                                                                                                                               | Agents self-verify the risky logic; humans eyeball UI feel.                                       |
| 13  | **Diagnostics**      | **Continuous**: every activity emits CEFR/category-tagged error events → weakness model → biases next content + feeds heatmap.                                                                                                            | Not a separate late module.                                                                       |
| 14  | **Gamification**     | **Light**: XP + daily streak + XP-based level + ~5 milestone achievements. All local/instant. **No** leaderboards/social.                                                                                                                 | Instant, zero-latency.                                                                            |

**Core stack:** Next.js 16 · React 19 · Turbopack · Serwist (`@serwist/turbopack`) · Tailwind v4 · Base UI · Dexie (IndexedDB) · Zod · Vercel AI SDK (OpenAI-compatible) · Framer Motion · `ts-fsrs` · Vitest · Playwright · TypeScript (strict).

---

## 2. System architecture

### 2.1 Topology

```
   ┌─────────────────────────── Your laptop ───────────────────────────┐
   │  Browser (PWA, installed)                                          │
   │     │  same-origin fetches only                                    │
   │     ▼                                                              │
   │  Next.js app (next start on localhost / Tailscale hostname)        │
   │     • UI (React 19, Base UI, Tailwind)                             │
   │     • IndexedDB via Dexie  (all learner data + content cache)      │
   │     • Server route handlers = the ONLY thing that talks to the Mac │
   └───────────────────────────────┬────────────────────────────────────┘
                                    │  LAN at home / Tailscale away (HTTPS)
                                    ▼
   ┌─────────────────────────── Home Mac (M4 Pro, 48 GB) ───────────────┐
   │  Ollama  (OpenAI-compatible /v1/chat/completions, /v1/embeddings)  │
   │     • primary ~14B   • utility ~7B   • embedding model             │
   │  whisper-server (whisper.cpp / faster-whisper)                     │
   └────────────────────────────────────────────────────────────────────┘
```

**Why the server-side proxy is mandatory:** a browser on an HTTPS page cannot call a plain-HTTP
LAN address (mixed content is blocked). The browser only ever calls the Next.js app (same origin);
the Next **server** calls the Mac. This also keeps the Mac endpoint/key out of client code.

### 2.2 Online vs offline behavior

| Capability                                                       | Works offline?       | Needs Mac reachable?     |
| ---------------------------------------------------------------- | -------------------- | ------------------------ |
| Dictionary lookup, word CEFR, synonyms/relations                 | ✅ (bundled)         | No                       |
| Vocab SRS review (existing cards)                                | ✅                   | No                       |
| Re-read already-generated/cached passages, retake cached quizzes | ✅                   | No                       |
| Placement quiz                                                   | ✅ (bundled dataset) | No                       |
| Starter-seed passages/deck (day one)                             | ✅ (bundled)         | No                       |
| Gamification (XP/streak/level/achievements)                      | ✅                   | No                       |
| **Generate** new passage/quiz/lesson                             | ❌                   | Yes                      |
| Writing feedback, conversation, enrichment agent                 | ❌                   | Yes                      |
| Listening TTS (browser)                                          | ✅                   | No                       |
| Listening transcription scoring (WER)                            | ✅ (logic local)     | No                       |
| Speaking transcription (Whisper)                                 | ❌                   | Yes (Mac whisper-server) |

**Rule:** anything the Mac produces is **validated then cached to IndexedDB**, so it becomes offline-available after first use.

### 2.3 The seams

| Seam                | Interface (conceptual)                                              | Local impl                                                          | Swap target later                             |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| `LLMClient`         | `chat(messages, {schema?, stream?})`, `embed(texts)`                | Vercel AI SDK → Ollama (OpenAI-compatible), via server proxy        | Cloud LLM (change `baseURL`/`model`/`apiKey`) |
| `LexiconProvider`   | `define(word)`, `relations(word)`, `cefrLevel(word)`, `audio(word)` | Bundled WordNet + Words-CEFR-Dataset + Free Dictionary API (cached) | Oxford/WordsAPI behind same interface         |
| `ContentRepository` | CRUD for profiles, cards, content, error-events, gamification       | Dexie/IndexedDB                                                     | Add a `SyncedRepository` (cloud) later        |
| `Transcriber`       | `transcribe(audio) → text`                                          | Mac whisper-server                                                  | Azure / cloud STT behind same interface       |
| `ContentValidator`  | `validate(text, targetCefr) → {ok, violations}`                     | Local: parse words → CEFR check + grammar-map check                 | —                                             |

> **Non-negotiable:** feature code imports the **interface**, never a concrete provider. Concretes are wired in one composition root (`lib/registry.ts`).

### 2.4 Generate → validate → cache pipeline

```
request content (topic, level, type)
   → LLMClient.chat(prompt, {schema})        # Zod-validated structured output
   → ContentValidator.validate(text, level)  # CEFR words + grammar map gate
        ├─ violations → corrective re-prompt (max N retries)
        └─ ok → ContentRepository.cacheContent(...)  # offline thereafter
   → render
```

### 2.5 Composition roots (split by environment)

- `lib/registry.ts` — **client-safe** (`getContentRepository`)
- `lib/llm/server.ts` — **server-only** (`getLLMClient`)
- `lib/lexicon/server.ts` — **server-only** (`getLexiconProvider`)

Dynamic `import()` does **not** keep `server-only` out of the client graph — environment splitting does.

### 2.6 Runtime config

Settings persist Mac endpoint/models to `profile.settings` (IndexedDB) **and** push to a
server-held override via `POST /api/llm/config` and `POST /api/stt/config`. Server-held overrides
persist in-process until restart. Connectivity indicator polls `/api/llm/health` and `/api/stt/health`.
State-changing POSTs are origin-guarded (`lib/server/origin.ts`).

---

## 3. Cross-cutting data model (Dexie tables)

- `profile` — single row: cefrLevel, goals, createdAt, settings.
- `cards` — vocab SRS cards: word, sense, definition, examples, cefr, FSRS state (due, stability, difficulty, reps, lapses).
- `content` — cached generated/seed content: type (passage|quiz|prompt|lesson), level, topic, payload (JSON), source (seed|generated|agent), validatedAt, embedding (optional). v2 compound index: `[type+level]`.
- `errorEvents` — diagnostics: skill, category, cefr, context (sentence), createdAt. v2 compound index: `[skill+cefr]`.
- `weakness` — derived: skill × category × cefr → score/confidence (recomputed from errorEvents via exponential decay, 30-day half-life).
- `gamification` — xp, level, streakCount, lastActivityDate, achievements[].
- `lexiconCache` — cached dictionary/audio lookups (from Free Dictionary API / agent).
