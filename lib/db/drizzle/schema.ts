import {
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
  SKILL_VALUES,
  STT_PROVIDER_VALUES,
  USER_ROLE_VALUES,
} from "./schema.shared";
import {
  CEFR_VALUES,
  CHAT_PROVIDER_VALUES,
  CONTENT_SOURCE_VALUES,
  CONTENT_TYPE_VALUES,
  EMBEDDINGS_PROVIDER_VALUES,
  EXPERIENCE_MODE_VALUES,
  SKILL_VALUES,
  STT_PROVIDER_VALUES,
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
  },
  (t) => [index("idx_cards_user_due").on(t.userId, t.dueAt)],
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
