import {
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

// Re-export shared constants so cloud code can import from one place.
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

// ─── Auth tables ──────────────────────────────────────────────────────────────

/**
 * App user metadata. Passwords live in Supabase Auth (`auth.users`); this table
 * stores the Lang-Tutor role and mirrors the auth user id.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: USER_ROLE_VALUES }).notNull().default("standard"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// ─── Shared tables (no userId) ────────────────────────────────────────────────

export const appConfig = pgTable("app_config", {
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const content = pgTable(
  "content",
  {
    id: serial("id").primaryKey(),
    type: text("type", { enum: CONTENT_TYPE_VALUES }).notNull(),
    level: text("level", { enum: CEFR_VALUES }).notNull(),
    topic: text("topic").notNull(),
    payload: text("payload").notNull(),
    source: text("source", { enum: CONTENT_SOURCE_VALUES }).notNull(),
    validatedAt: timestamp("validated_at", { withTimezone: true }).notNull(),
    embedding: text("embedding"),
  },
  (t) => [index("idx_content_type_level").on(t.type, t.level)],
);

export const lexiconCache = pgTable("lexicon_cache", {
  word: text("word").primaryKey(),
  data: text("data").notNull(),
  cachedAt: timestamp("cached_at", { withTimezone: true }).notNull(),
});

// ─── Per-user tables (have userId) ────────────────────────────────────────────

export const profiles = pgTable(
  "profile",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    cefrLevel: text("cefr_level", { enum: CEFR_VALUES }),
    goals: text("goals").notNull().default("[]"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    settings: text("settings").notNull().default("{}"),
    experienceMode: text("experience_mode", { enum: EXPERIENCE_MODE_VALUES }),
  },
  (t) => [uniqueIndex("idx_profile_user_id").on(t.userId)],
);

export const cards = pgTable(
  "cards",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    word: text("word").notNull(),
    sense: text("sense"),
    definition: text("definition").notNull(),
    examples: text("examples").notNull().default("[]"),
    cefr: text("cefr", { enum: CEFR_VALUES }).notNull(),
    fsrs: text("fsrs").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    embedding: text("embedding"),
  },
  (t) => [index("idx_cards_user_due").on(t.userId, t.dueAt)],
);

export const errorEvents = pgTable(
  "error_events",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    skill: text("skill", { enum: SKILL_VALUES }).notNull(),
    category: text("category").notNull(),
    cefr: text("cefr", { enum: CEFR_VALUES }).notNull(),
    context: text("context").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("idx_error_events_skill_cefr").on(t.userId, t.skill, t.cefr)],
);

export const weakness = pgTable(
  "weakness",
  {
    userId: uuid("user_id").notNull(),
    skill: text("skill", { enum: SKILL_VALUES }).notNull(),
    category: text("category").notNull(),
    cefr: text("cefr", { enum: CEFR_VALUES }).notNull(),
    score: doublePrecision("score").notNull(),
    confidence: doublePrecision("confidence").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skill, t.category, t.cefr] })],
);

export const gamification = pgTable(
  "gamification",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    streakCount: integer("streak_count").notNull().default(0),
    lastActivityDate: text("last_activity_date"),
    achievements: text("achievements").notNull().default("[]"),
  },
  (t) => [uniqueIndex("idx_gamification_user_id").on(t.userId)],
);
