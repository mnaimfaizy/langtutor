/**
 * Entity types for the IndexedDB data model (PLAN.md §4).
 *
 * These are plain TypeScript shapes — the persisted records. The Dexie store
 * declarations live in `database.ts`; the CRUD seam in `content-repository.ts`.
 * Nothing here imports Dexie, so the model is storage-agnostic.
 */

/** CEFR proficiency level (A1 easiest → C2 hardest). */
export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/** The four trainable skills — the primary diagnostics dimension. */
export type Skill = "reading" | "writing" | "listening" | "speaking";

/** Kind of cached content (PLAN §4 `content.type`). */
export type ContentType = "passage" | "quiz" | "prompt" | "lesson";

/** Provenance of a piece of content (PLAN §4 `content.source`). */
export type ContentSource = "seed" | "generated" | "agent";

/** Learner goals captured at onboarding (PLAN §2.2). */
export type LearnerGoal = "travel" | "work" | "exam" | "general";

/**
 * Presentation mode for the whole app UI (ADR 0014): selects the palette family
 * (premium-dark adult vs. bright kid) and, later, navigation density and content tone.
 * Independent of `cefrLevel` — content difficulty and presentation style don't couple.
 */
export type ExperienceMode = "adult" | "kid";

/** Default for new profiles and legacy rows saved before this field existed. */
export const DEFAULT_EXPERIENCE_MODE: ExperienceMode = "adult";

/**
 * Runtime overrides for the Mac endpoints / model names and TTS prefs, set in the
 * Settings UI and persisted in the profile (PLAN §3.2). Defaults come from server-only
 * env; these only ever override at runtime. No secrets/API keys live here.
 */
export interface ProfileSettings {
  chatProvider?: "mac" | "groq";
  chatModel?: string;
  sttProvider?: "mac" | "groq";
  embeddingsProvider?: "mac" | "mistral";
  embeddingsModel?: string;
  macLlmBaseUrl?: string;
  macLlmModel?: string;
  macUtilityModel?: string;
  macEmbedModel?: string;
  macSttUrl?: string;
  ttsRate?: number;
  ttsVoiceUri?: string;
  ttsLang?: string;
}

/**
 * Single-row learner profile (PLAN §4 `profile`).
 *
 * `cefrLevel`/`goals` are populated by onboarding (Phase 2); a profile can exist before
 * then to hold `settings` (the Settings shell, Phase 0.6, runs pre-onboarding). Treat
 * "onboarded" as `cefrLevel != null`, not "profile row exists".
 */
export interface Profile {
  cefrLevel?: Cefr;
  goals: LearnerGoal[];
  createdAt: Date;
  settings: ProfileSettings;
  /** Undefined means "not chosen yet" — treat as {@link DEFAULT_EXPERIENCE_MODE}. */
  experienceMode?: ExperienceMode;
}

/**
 * Per-card scheduling snapshot. Mirrors the field set of a `ts-fsrs` card so the SRS
 * wrapper (Phase 2.3) can read/write it directly; `state` is the ts-fsrs State enum
 * (0=New, 1=Learning, 2=Review, 3=Relearning).
 */
export interface FsrsState {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  /** ts-fsrs v5 learning-step counter (tracks position within learning steps). */
  learningSteps?: number;
  state: number;
  lastReview?: Date;
}

/** Vocab SRS card (PLAN §4 `cards`). */
export interface Card {
  id: number;
  word: string;
  /** WordNet sense key / disambiguator (optional until the lexicon lands, Phase 1). */
  sense?: string;
  definition: string;
  examples: string[];
  cefr: Cefr;
  fsrs: FsrsState;
  createdAt: Date;
  /** Semantic embedding vector from the configured embed model (Phase 1.6). */
  embedding?: number[];
}

/** Cached generated/seed content (PLAN §4 `content`). */
export interface Content {
  id: number;
  type: ContentType;
  level: Cefr;
  topic: string;
  /** Validated, structured payload; shape depends on `type` and is Zod-parsed by callers. */
  payload: unknown;
  source: ContentSource;
  validatedAt: Date;
  /** Optional semantic-search embedding (Phase 1.6). */
  embedding?: number[];
}

/**
 * A single tagged diagnostics error event (PLAN §4 `errorEvents`).
 * Named `…Record` to avoid colliding with the DOM `ErrorEvent` global.
 */
export interface ErrorEventRecord {
  id: number;
  skill: Skill;
  /** Error category (e.g. a grammar construction); free-form until the grammar map lands (Phase 1.4). */
  category: string;
  cefr: Cefr;
  /** The sentence/context in which the error occurred. */
  context: string;
  createdAt: Date;
}

/**
 * Derived weakness rollup (PLAN §4 `weakness`), recomputed from `errorEvents` in
 * Phase 7.1. Keyed by the (skill, category, cefr) triple.
 */
export interface Weakness {
  skill: Skill;
  category: string;
  cefr: Cefr;
  /** 0..1, higher = weaker. */
  score: number;
  /** 0..1 confidence in the score. */
  confidence: number;
  updatedAt: Date;
}

/** An unlocked gamification achievement. */
export interface Achievement {
  id: string;
  unlockedAt: Date;
}

/** Single-row gamification state (PLAN §4 `gamification`). */
export interface GamificationState {
  xp: number;
  level: number;
  streakCount: number;
  /** Local calendar date of last activity, ISO `YYYY-MM-DD`; null before first activity. */
  lastActivityDate: string | null;
  achievements: Achievement[];
}

/** Cached dictionary/audio lookup (PLAN §4 `lexiconCache`). Stores structured data, never raw HTML. */
export interface LexiconCacheEntry {
  /** Lowercased word — the cache key. */
  word: string;
  data: unknown;
  cachedAt: Date;
}

/**
 * Lifecycle of a {@link Unit} on the learning path (ADR 0015). `locked` units are visible
 * but not yet startable; `available` is the next unit up; `in-progress`/`completed` track
 * a unit the learner has started/finished. The backbone seeder (path-skeleton, issue #57)
 * only ever produces `locked`/`available` — the other two are set once activities exist.
 */
export type UnitStatus = "locked" | "available" | "in-progress" | "completed";

/**
 * Whether a unit's activity content has been pre-generated for offline use (ADR 0015's
 * "path buffer"). Backbone-seeded units are always `empty` — nothing to buffer yet since
 * no LLM/content-pipeline call has happened.
 */
export type UnitBufferStatus = "empty" | "buffered";

/**
 * One ordered slot in a unit's activity list. `contentId` is undefined until the teacher
 * plans and the content pipeline generates/caches the activity (future work) — the
 * backbone seeder only reserves the slot and its skill.
 */
export interface UnitActivityRef {
  skill: Skill;
  contentId?: number;
}

/**
 * One node on the learning path (ADR 0015, glossary "Unit"; PLAN §4 `units`).
 *
 * `index` orders units ascending on the path. Backbone seeding (issue #57) starts at 0;
 * negative indices are reserved for a future pre-A1 tier (ADR 0016) that will be inserted
 * before the first A1 unit — the seeder never produces one yet.
 */
export interface Unit {
  id: number;
  index: number;
  title: string;
  teacherNote: string;
  /** Grammar-map construction ids (§`lib/content/grammar-map.ts`) this unit targets. */
  targetGrammarIds: string[];
  /** CEFR milestone this unit's vocabulary/grammar difficulty is anchored to. */
  targetCefr: Cefr;
  activities: UnitActivityRef[];
  status: UnitStatus;
  bufferStatus: UnitBufferStatus;
  createdAt: Date;
}
