import {
  boolean,
  customType,
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
  MEDIA_ASSET_APPROVAL_STATUS_VALUES,
  MEDIA_ASSET_KIND_VALUES,
  MEDIA_ASSET_SOURCE_VALUES,
  CHAPTER_GATE_STATUS_VALUES,
  CHAPTER_TIER_VALUES,
  COLLECTION_KIND_VALUES,
  PRE_A1_STAGE_ID_VALUES,
  SHARED_PATH_APPROVAL_STATUS_VALUES,
  SHARED_PATH_PROVENANCE_VALUES,
  SHARED_PATH_RICHNESS_VALUES,
  SKILL_VALUES,
  STT_PROVIDER_VALUES,
  UNIT_BUFFER_STATUS_VALUES,
  UNIT_STATUS_VALUES,
  USER_ROLE_VALUES,
} from "./schema.shared";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// Re-export shared constants so cloud code can import from one place.
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
  PRE_A1_STAGE_ID_VALUES,
  SHARED_PATH_APPROVAL_STATUS_VALUES,
  SHARED_PATH_PROVENANCE_VALUES,
  SHARED_PATH_RICHNESS_VALUES,
  SKILL_VALUES,
  STT_PROVIDER_VALUES,
  UNIT_BUFFER_STATUS_VALUES,
  UNIT_STATUS_VALUES,
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

export const mediaAssets = pgTable(
  "media_assets",
  {
    kind: text("kind", { enum: MEDIA_ASSET_KIND_VALUES }).notNull(),
    key: text("key").notNull(),
    style: text("style").notNull(),
    mimeType: text("mime_type").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    source: text("source", { enum: MEDIA_ASSET_SOURCE_VALUES }).notNull().default("generated"),
    approvalStatus: text("approval_status", { enum: MEDIA_ASSET_APPROVAL_STATUS_VALUES })
      .notNull()
      .default("approved"),
    /** Generation prompt / spoken text for generated assets (ADR 0024 / 0044); null for curated-pack. */
    prompt: text("prompt"),
  },
  (t) => [primaryKey({ columns: [t.kind, t.key, t.style] })],
);

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
    suspended: boolean("suspended").notNull().default(false),
  },
  (t) => [index("idx_cards_user_due").on(t.userId, t.dueAt)],
);

export const collections = pgTable("collections", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind", { enum: COLLECTION_KIND_VALUES }).notNull(),
});

export const cardCollectionMembers = pgTable(
  "card_collection_members",
  {
    userId: uuid("user_id").notNull(),
    collectionId: integer("collection_id").notNull(),
    cardId: integer("card_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.collectionId, t.cardId] })],
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

export const questState = pgTable(
  "quest_state",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    dailyPeriodStart: text("daily_period_start"),
    weeklyPeriodStart: text("weekly_period_start"),
    entries: text("entries").notNull().default("[]"),
  },
  (t) => [uniqueIndex("idx_quest_state_user_id").on(t.userId)],
);

export const collectibleGrants = pgTable(
  "collectible_grants",
  {
    userId: uuid("user_id").notNull(),
    collectibleId: text("collectible_id").notNull(),
    unitId: integer("unit_id").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.collectibleId, t.unitId] })],
);

export const units = pgTable(
  "units",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("idx_units_user_index").on(t.userId, t.index)],
);

/** Per-user chapter mastery-gate status (ADR 0043, issues #114/#117). */
export const chapterGates = pgTable(
  "chapter_gates",
  {
    userId: uuid("user_id").notNull(),
    tier: text("tier", { enum: CHAPTER_TIER_VALUES }).notNull(),
    status: text("status", { enum: CHAPTER_GATE_STATUS_VALUES }).notNull().default("pending"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    /** JSON {@link ChapterReviewAssignment} or null (issue #117). */
    reviewAssignment: text("review_assignment"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tier] })],
);

/** Shared pre-A1 path catalog stages (ADR 0051, issue #125). */
export const sharedPathStages = pgTable("shared_path_stages", {
  id: text("id", { enum: PRE_A1_STAGE_ID_VALUES }).primaryKey(),
  tier: text("tier", { enum: CHAPTER_TIER_VALUES }).notNull().default("pre-A1"),
  title: text("title").notNull(),
  spineSectionKey: text("spine_section_key").notNull(),
  order: integer("stage_order").notNull(),
  readyForExam: boolean("ready_for_exam").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

/** Shared pre-A1 path catalog unit templates (ADR 0051, issue #125). */
export const sharedPathUnitTemplates = pgTable(
  "shared_path_unit_templates",
  {
    id: text("id").primaryKey(),
    tier: text("tier", { enum: CHAPTER_TIER_VALUES }).notNull().default("pre-A1"),
    stageId: text("stage_id", { enum: PRE_A1_STAGE_ID_VALUES }).notNull(),
    stageOrder: integer("stage_order").notNull(),
    pathIndex: integer("path_index").notNull(),
    title: text("title").notNull(),
    teacherNote: text("teacher_note").notNull(),
    activities: text("activities").notNull().default("[]"),
    richness: text("richness", { enum: SHARED_PATH_RICHNESS_VALUES }).notNull(),
    approvalStatus: text("approval_status", { enum: SHARED_PATH_APPROVAL_STATUS_VALUES })
      .notNull()
      .default("approved"),
    provenance: text("provenance", { enum: SHARED_PATH_PROVENANCE_VALUES }).notNull(),
    targetVocab: text("target_vocab").notNull().default("[]"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("idx_shared_path_unit_templates_path_index").on(t.pathIndex)],
);
