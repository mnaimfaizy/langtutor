import {
  blob,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export {
  BOOTSTRAP_ADMIN_ID,
  CEFR_VALUES,
  CHAT_PROVIDER_VALUES,
  CONTENT_SOURCE_VALUES,
  CONTENT_TYPE_VALUES,
  EMBEDDINGS_PROVIDER_VALUES,
  EXPERIENCE_MODE_VALUES,
  MEDIA_ASSET_APPROVAL_STATUS_VALUES,
  MEDIA_ASSET_KIND_VALUES,
  MEDIA_ASSET_SOURCE_VALUES,
  CHAPTER_GATE_STATUS_VALUES,
  CHAPTER_TIER_VALUES,
  COLLECTION_KIND_VALUES,
  SKILL_VALUES,
  STT_PROVIDER_VALUES,
  UNIT_BUFFER_STATUS_VALUES,
  UNIT_STATUS_VALUES,
  USER_ROLE_VALUES,
} from "./schema.shared";
import {
  CEFR_VALUES,
  CHAT_PROVIDER_VALUES,
  CONTENT_SOURCE_VALUES,
  CONTENT_TYPE_VALUES,
  EMBEDDINGS_PROVIDER_VALUES,
  EXPERIENCE_MODE_VALUES,
  MEDIA_ASSET_APPROVAL_STATUS_VALUES,
  MEDIA_ASSET_KIND_VALUES,
  MEDIA_ASSET_SOURCE_VALUES,
  CHAPTER_GATE_STATUS_VALUES,
  CHAPTER_TIER_VALUES,
  COLLECTION_KIND_VALUES,
  SKILL_VALUES,
  STT_PROVIDER_VALUES,
  UNIT_BUFFER_STATUS_VALUES,
  UNIT_STATUS_VALUES,
  USER_ROLE_VALUES,
} from "./schema.shared";

// ─── Auth tables ──────────────────────────────────────────────────────────────

/** Registered users. `role` controls admin-only operations. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: USER_ROLE_VALUES }).notNull().default("standard"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

/** Server-side sessions — one row per active login. */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// ─── Shared tables (no userId) ────────────────────────────────────────────────

/** Global AI/infra config — one row, admin-editable, seeded from env on first boot. */
export const appConfig = sqliteTable("app_config", {
  id: integer("id").primaryKey(),
  chatProvider: text("chat_provider", { enum: CHAT_PROVIDER_VALUES }).notNull().default("mac"),
  chatModel: text("chat_model").notNull().default(""),
  sttProvider: text("stt_provider", { enum: STT_PROVIDER_VALUES }).notNull().default("mac"),
  embeddingsProvider: text("embeddings_provider", { enum: EMBEDDINGS_PROVIDER_VALUES })
    .notNull()
    .default("mac"),
  embeddingsModel: text("embeddings_model").notNull().default(""),
  macLlmBaseUrl: text("mac_llm_base_url").notNull(),
  macLlmModel: text("mac_llm_model").notNull(),
  macUtilityModel: text("mac_utility_model").notNull(),
  macEmbedModel: text("mac_embed_model").notNull(),
  macSttUrl: text("mac_stt_url").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/** Cached generated/seed content — shared across all learners by type/level/topic. */
export const content = sqliteTable(
  "content",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type", { enum: CONTENT_TYPE_VALUES }).notNull(),
    level: text("level", { enum: CEFR_VALUES }).notNull(),
    topic: text("topic").notNull(),
    payload: text("payload").notNull(),
    source: text("source", { enum: CONTENT_SOURCE_VALUES }).notNull(),
    validatedAt: integer("validated_at", { mode: "timestamp" }).notNull(),
    embedding: text("embedding"),
  },
  (t) => [index("idx_content_type_level").on(t.type, t.level)],
);

/** Cached dictionary/audio lookups — keyed by lowercased word. */
export const lexiconCache = sqliteTable("lexicon_cache", {
  word: text("word").primaryKey(),
  data: text("data").notNull(),
  cachedAt: integer("cached_at", { mode: "timestamp" }).notNull(),
});

/** Shared image/audio clips — keyed by (kind, word/phrase, style); ADR 0016. */
export const mediaAssets = sqliteTable(
  "media_assets",
  {
    kind: text("kind", { enum: MEDIA_ASSET_KIND_VALUES }).notNull(),
    key: text("key").notNull(),
    style: text("style").notNull(),
    mimeType: text("mime_type").notNull(),
    data: blob("data", { mode: "buffer" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    source: text("source", { enum: MEDIA_ASSET_SOURCE_VALUES }).notNull().default("generated"),
    approvalStatus: text("approval_status", { enum: MEDIA_ASSET_APPROVAL_STATUS_VALUES })
      .notNull()
      .default("approved"),
    /** Generation prompt for generated images only (ADR 0024); null for curated-pack/audio. */
    prompt: text("prompt"),
  },
  (t) => [primaryKey({ columns: [t.kind, t.key, t.style] })],
);

// ─── Per-user tables (have userId) ────────────────────────────────────────────

/**
 * Per-user learner profile. `cefrLevel`/`goals` are set during onboarding.
 * `settings` holds TTS prefs only — AI/infra config moved to `appConfig`.
 */
export const profiles = sqliteTable(
  "profile",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    cefrLevel: text("cefr_level", { enum: CEFR_VALUES }),
    goals: text("goals").notNull().default("[]"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    settings: text("settings").notNull().default("{}"),
    experienceMode: text("experience_mode", { enum: EXPERIENCE_MODE_VALUES }),
  },
  (t) => [uniqueIndex("idx_profile_user_id").on(t.userId)],
);

/**
 * Vocabulary SRS cards. `dueAt` is a denormalized copy of `fsrs.due` so the
 * "cards due" query can use a B-tree index instead of scanning JSON.
 */
export const cards = sqliteTable(
  "cards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    word: text("word").notNull(),
    sense: text("sense"),
    definition: text("definition").notNull(),
    examples: text("examples").notNull().default("[]"),
    cefr: text("cefr", { enum: CEFR_VALUES }).notNull(),
    fsrs: text("fsrs").notNull(),
    dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    embedding: text("embedding"),
    suspended: integer("suspended", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("idx_cards_user_due").on(t.userId, t.dueAt)],
);

/** Named deck collections — user-created or unit-scoped (issue #90). */
export const collections = sqliteTable("collections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind", { enum: COLLECTION_KIND_VALUES }).notNull(),
});

/** Many-to-many card membership in deck collections (issue #90). */
export const cardCollectionMembers = sqliteTable(
  "card_collection_members",
  {
    userId: text("user_id").notNull(),
    collectionId: integer("collection_id").notNull(),
    cardId: integer("card_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.collectionId, t.cardId] })],
);

/** Diagnostics error events — one row per tagged mistake. */
export const errorEvents = sqliteTable(
  "error_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    skill: text("skill", { enum: SKILL_VALUES }).notNull(),
    category: text("category").notNull(),
    cefr: text("cefr", { enum: CEFR_VALUES }).notNull(),
    context: text("context").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("idx_error_events_skill_cefr").on(t.userId, t.skill, t.cefr)],
);

/** Derived weakness rollups — compound PK mirrors the Dexie [skill+category+cefr] key. */
export const weakness = sqliteTable(
  "weakness",
  {
    userId: text("user_id").notNull(),
    skill: text("skill", { enum: SKILL_VALUES }).notNull(),
    category: text("category").notNull(),
    cefr: text("cefr", { enum: CEFR_VALUES }).notNull(),
    score: real("score").notNull(),
    confidence: real("confidence").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skill, t.category, t.cefr] })],
);

/** Single-row gamification state per user (XP, streak, achievements). */
export const gamification = sqliteTable(
  "gamification",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    streakCount: integer("streak_count").notNull().default(0),
    lastActivityDate: text("last_activity_date"),
    achievements: text("achievements").notNull().default("[]"),
  },
  (t) => [uniqueIndex("idx_gamification_user_id").on(t.userId)],
);

/** Per-user quest progress (singleton row; ADR 0019, issue #76). */
export const questState = sqliteTable(
  "quest_state",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    dailyPeriodStart: text("daily_period_start"),
    weeklyPeriodStart: text("weekly_period_start"),
    entries: text("entries").notNull().default("[]"),
  },
  (t) => [uniqueIndex("idx_quest_state_user_id").on(t.userId)],
);

/** Per-user collectible grants — one row per (collectible, unit); idempotent by compound PK. */
export const collectibleGrants = sqliteTable(
  "collectible_grants",
  {
    userId: text("user_id").notNull(),
    collectibleId: text("collectible_id").notNull(),
    unitId: integer("unit_id").notNull(),
    grantedAt: integer("granted_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.collectibleId, t.unitId] })],
);

/**
 * Learning path units (ADR 0015). `index` orders the path ascending; negative values are
 * reserved for a future pre-A1 tier (ADR 0016). Backbone seeding (issue #57) writes
 * `targetGrammarIds`/`activities` as JSON arrays, same convention as `examples`/`goals`.
 * The teacher planner (issue #58) fills `targetVocab` (also JSON) once it plans a unit;
 * empty is the "unplanned" signal.
 */
export const units = sqliteTable(
  "units",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull(),
    index: integer("unit_index").notNull(),
    title: text("title").notNull(),
    teacherNote: text("teacher_note").notNull(),
    targetGrammarIds: text("target_grammar_ids").notNull().default("[]"),
    targetVocab: text("target_vocab").notNull().default("[]"),
    targetCefr: text("target_cefr", { enum: CEFR_VALUES }).notNull(),
    activities: text("activities").notNull().default("[]"),
    status: text("status", { enum: UNIT_STATUS_VALUES }).notNull().default("locked"),
    bufferStatus: text("buffer_status", { enum: UNIT_BUFFER_STATUS_VALUES })
      .notNull()
      .default("empty"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [uniqueIndex("idx_units_user_index").on(t.userId, t.index)],
);

/** Per-user chapter mastery-gate status (ADR 0043, issues #114/#117). */
export const chapterGates = sqliteTable(
  "chapter_gates",
  {
    userId: text("user_id").notNull(),
    tier: text("tier", { enum: CHAPTER_TIER_VALUES }).notNull(),
    status: text("status", { enum: CHAPTER_GATE_STATUS_VALUES }).notNull().default("pending"),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
    /** JSON {@link ChapterReviewAssignment} or null (issue #117). */
    reviewAssignment: text("review_assignment"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tier] })],
);
