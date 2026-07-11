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

/** Strict vs open chapter-gate progression (ADR 0033). Default for new adults is strict. */
export type ProgressionMode = "strict" | "open";

export const DEFAULT_PROGRESSION_MODE: ProgressionMode = "strict";

/** Chapter / tier key for mastery-gate status (ADR 0035 / 0043). */
export type ChapterTier = Cefr | "pre-A1";

/**
 * Chapter mastery-gate lifecycle (ADR 0034 / 0043, issue #117).
 * - pending: exam not yet passed (first attempt available)
 * - failed_review: strict fail; review assignment incomplete; retake blocked
 * - ready_retake: review complete; retake offered; A1 still locked until pass
 * - passed: exam passed; next chapter unlocked
 */
export type ChapterGateStatus = "pending" | "failed_review" | "ready_retake" | "passed";

/** One teacher-assigned review target within a failed chapter (ADR 0036). */
export interface ChapterReviewAssignmentItem {
  id: string;
  /** Pre-A1 unit index (e.g. -4 … -1). */
  unitIndex: number;
  /** Exam skill section to practice. */
  skill: string;
  label: string;
  done: boolean;
}

/** Structured review assignment tied to a failed gate attempt (ADR 0036, issue #117). */
export interface ChapterReviewAssignment {
  items: ChapterReviewAssignmentItem[];
  createdAt: string;
  attemptContentId?: number;
}

/** Persisted chapter mastery-gate status for one tier (ADR 0043, issues #114/#117). */
export interface ChapterGate {
  tier: ChapterTier;
  status: ChapterGateStatus;
  updatedAt: Date;
  /** Present while strict-mode fail review is active; cleared on pass. */
  reviewAssignment?: ChapterReviewAssignment | null;
}

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
  /** Adult-mode opt-in for pre-A1 placeholder units on the path (ADR 0016, issue #66). */
  enablePreA1?: boolean;
  /** When true, celebration sound effects are silenced (issue #81). */
  soundMuted?: boolean;
  /**
   * Adult-selectable progression mode for chapter mastery gates (ADR 0033 / 0042).
   * Kids always resolve to `"strict"` regardless of this field — see
   * `effectiveProgressionMode` in `lib/path/chapter-gate.ts`.
   */
  progressionMode?: ProgressionMode;
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

/** Deck collection kind — user-created vs. unit-scoped (deck overhaul, issue #90). */
export type CollectionKind = "user" | "unit";

/** A named deck collection; cards may belong to multiple collections. */
export interface Collection {
  id: number;
  name: string;
  kind: CollectionKind;
}

/** {@link Collection} plus membership count for list views. */
export interface CollectionSummary extends Collection {
  cardCount: number;
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
  /** When true, excluded from due queries; FSRS snapshot is retained (issue #90). */
  suspended?: boolean;
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

/** Progress toward one quest definition within the current daily/weekly period. */
export interface QuestProgressEntry {
  questId: string;
  progress: number;
  /** Set when the quest target is met for the current period; null while in progress. */
  completedAt: Date | null;
  /** Last local calendar day that incremented progress (active-day weekly quests). */
  lastCountedDay?: string | null;
}

/** Per-user quest progress (singleton row). Daily/weekly rollover slices read and write this. */
export interface QuestState {
  /** ISO `YYYY-MM-DD` local date when daily quests were last refreshed. */
  dailyPeriodStart: string | null;
  /** ISO `YYYY-MM-DD` local date when weekly quests were last refreshed. */
  weeklyPeriodStart: string | null;
  entries: QuestProgressEntry[];
}

/** A collectible earned by completing a learning-path unit (ADR 0019). */
export interface CollectibleGrant {
  collectibleId: string;
  unitId: number;
  grantedAt: Date;
}

/** Kind of shared media asset in the store (ADR 0016). */
export type MediaAssetKind = "image" | "audio";

/** How a media asset entered the store — generated on demand or from the curated pack. */
export type MediaAssetSource = "generated" | "curated-pack";

/** Kid-safety review gate for generated images and audio (ADR 0028). */
export type MediaAssetApprovalStatus = "pending" | "approved";

/** Default approval for a new asset from the given source. */
export function defaultMediaAssetApproval(source: MediaAssetSource): MediaAssetApprovalStatus {
  return source === "curated-pack" ? "approved" : "pending";
}

/**
 * Lookup key for a shared media asset — (kind, word/phrase, style). Keys are
 * human-readable for debugging and admin review (ADR 0016).
 */
export interface MediaAssetKey {
  kind: MediaAssetKind;
  /** Word or phrase; normalized to lowercase on storage. */
  key: string;
  style: string;
}

/** A persisted image or audio clip in the shared media asset store (ADR 0016). */
export interface MediaAsset extends MediaAssetKey {
  data: Uint8Array;
  mimeType: string;
  createdAt: Date;
  source: MediaAssetSource;
  approvalStatus: MediaAssetApprovalStatus;
  /**
   * Exact prompt sent to the image provider for this generation (ADR 0024).
   * Set only for `source: "generated"` images; null for curated-pack and audio.
   */
  prompt: string | null;
}

/** Metadata for admin media listings — omits the binary payload. */
export type MediaAssetRecord = Omit<MediaAsset, "data">;

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
 * Which module a unit's activity slot deep-links into: one of the four trainable skills,
 * or `"review"` (vocabulary SRS review — not a diagnosed skill, so it lives outside
 * {@link Skill} rather than widening that diagnostics-dimension type).
 */
export type ActivityKind =
  | Skill
  | "review"
  | "alphabet"
  | "phonics"
  | "picture-match"
  | "listen-tap";

/**
 * One ordered slot in a unit's activity list. `contentId` is undefined until the teacher
 * plans and the content pipeline generates/caches the activity, or (issue #59) until the
 * unit player lazily generates it on first open — the backbone seeder only reserves the
 * slot and its kind. `done` is set by the unit player's completion state machine
 * (issue #59); undefined/false means pending.
 */
export interface UnitActivityRef {
  skill: ActivityKind;
  contentId?: number;
  done?: boolean;
}

/**
 * One node on the learning path (ADR 0015, glossary "Unit"; PLAN §4 `units`).
 *
 * `index` orders units ascending on the path. A1+ backbone seeding (issue #57) starts at 0;
 * negative indices hold the pre-A1 tier (ADR 0016, issue #66) inserted before unit 0.
 */
export interface Unit {
  id: number;
  index: number;
  title: string;
  teacherNote: string;
  /** Grammar-map construction ids (§`lib/content/grammar-map.ts`) this unit targets. */
  targetGrammarIds: string[];
  /**
   * Vocabulary words the teacher plan chose for this unit (issue #58). Empty means the
   * unit is still an unplanned backbone placeholder — the teacher planner's own signal
   * for "needs planning", so no separate plan-status field is needed.
   */
  targetVocab: string[];
  /** CEFR milestone this unit's vocabulary/grammar difficulty is anchored to. */
  targetCefr: Cefr;
  activities: UnitActivityRef[];
  status: UnitStatus;
  bufferStatus: UnitBufferStatus;
  createdAt: Date;
}
