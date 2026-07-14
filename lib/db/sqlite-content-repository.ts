import { and, asc, eq, inArray, lte } from "drizzle-orm";

import { env } from "@/lib/config/env";
import {
  decodeSharedPathTargetVocab,
  encodeSharedPathTargetVocab,
} from "@/lib/path/shared-path-target-vocab";

import type { BackupData } from "../backup/schema";
import type {
  ContentQuery,
  ContentRepository,
  ErrorEventQuery,
  MediaAssetQuery,
  NewCard,
  NewCollection,
  NewContent,
  NewErrorEvent,
  NewUnit,
  SharedPathUnitTemplateQuery,
} from "./content-repository";
import type { DrizzleClient } from "./drizzle/client";
import {
  BOOTSTRAP_ADMIN_ID,
  appConfig,
  cardCollectionMembers as cardCollectionMembersTable,
  cards as cardsTable,
  collections as collectionsTable,
  content as contentTable,
  errorEvents as errorEventsTable,
  gamification as gamificationTable,
  lexiconCache as lexiconCacheTable,
  mediaAssets as mediaAssetsTable,
  collectibleGrants as collectibleGrantsTable,
  questState as questStateTable,
  chapterGates as chapterGatesTable,
  profiles as profilesTable,
  sharedPathStages as sharedPathStagesTable,
  sharedPathUnitTemplates as sharedPathUnitTemplatesTable,
  units as unitsTable,
  weakness as weaknessTable,
} from "./drizzle/schema";
import type {
  Achievement,
  Card,
  ChapterGate,
  ChapterTier,
  CollectibleGrant,
  CollectionSummary,
  Content,
  ErrorEventRecord,
  FsrsState,
  GamificationState,
  LexiconCacheEntry,
  MediaAsset,
  MediaAssetKey,
  MediaAssetRecord,
  SharedPathStage,
  SharedPathUnitTemplate,
  Profile,
  ProfileSettings,
  QuestProgressEntry,
  QuestState,
  Unit,
  UnitActivityRef,
  Weakness,
} from "./schema";
import { initCard } from "@/lib/srs/fsrs-wrapper";

const APP_CONFIG_ID = 1;
const DEFAULT_GROQ_CHAT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_MISTRAL_EMBED_MODEL = "mistral-embed";

function applyEnvFirstAiSettings(settings: ProfileSettings): ProfileSettings {
  if (env.LANGTUTOR_MODE !== "cloud") return settings;

  return {
    ...settings,
    chatProvider: "groq",
    chatModel: env.GROQ_CHAT_MODEL?.trim() || settings.chatModel || DEFAULT_GROQ_CHAT_MODEL,
    sttProvider: "groq",
    embeddingsProvider: "mistral",
    embeddingsModel:
      env.MISTRAL_EMBED_MODEL?.trim() || settings.embeddingsModel || DEFAULT_MISTRAL_EMBED_MODEL,
  };
}

function normalizeMediaAssetKey(key: MediaAssetKey): MediaAssetKey {
  return { ...key, key: key.key.toLowerCase() };
}

function rowToMediaAsset(row: typeof mediaAssetsTable.$inferSelect): MediaAsset {
  return {
    kind: row.kind,
    key: row.key,
    style: row.style,
    mimeType: row.mimeType,
    data: bufferToUint8Array(row.data),
    createdAt: row.createdAt,
    source: row.source,
    approvalStatus: row.approvalStatus,
    prompt: row.prompt ?? null,
  };
}

function rowToMediaAssetRecord(row: typeof mediaAssetsTable.$inferSelect): MediaAssetRecord {
  const { data: _data, ...record } = rowToMediaAsset(row);
  return record;
}

function bufferToUint8Array(data: Buffer): Uint8Array {
  return new Uint8Array(data);
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

function parseFsrs(json: string): FsrsState {
  const raw = JSON.parse(json) as {
    due: string;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
    reps: number;
    lapses: number;
    learningSteps?: number;
    state: number;
    lastReview?: string;
  };
  return {
    due: new Date(raw.due),
    stability: raw.stability,
    difficulty: raw.difficulty,
    elapsedDays: raw.elapsedDays,
    scheduledDays: raw.scheduledDays,
    reps: raw.reps,
    lapses: raw.lapses,
    learningSteps: raw.learningSteps,
    state: raw.state,
    lastReview: raw.lastReview ? new Date(raw.lastReview) : undefined,
  };
}

function parseAchievements(json: string): Achievement[] {
  const raw = JSON.parse(json) as Array<{ id: string; unlockedAt: string | Date }>;
  return raw.map((a) => ({ id: a.id, unlockedAt: new Date(a.unlockedAt) }));
}

function parseReviewAssignment(json: string | null): ChapterGate["reviewAssignment"] {
  if (json == null || json === "") return null;
  return JSON.parse(json) as NonNullable<ChapterGate["reviewAssignment"]>;
}

function rowToChapterGate(row: typeof chapterGatesTable.$inferSelect): ChapterGate {
  return {
    tier: row.tier,
    status: row.status,
    updatedAt: row.updatedAt,
    reviewAssignment: parseReviewAssignment(row.reviewAssignment),
  };
}

function rowToSharedPathStage(row: typeof sharedPathStagesTable.$inferSelect): SharedPathStage {
  return {
    id: row.id,
    tier: "pre-A1",
    title: row.title,
    spineSectionKey: row.spineSectionKey,
    order: row.order,
    readyForExam: row.readyForExam,
    updatedAt: row.updatedAt,
  };
}

function rowToSharedPathUnitTemplate(
  row: typeof sharedPathUnitTemplatesTable.$inferSelect,
): SharedPathUnitTemplate {
  const decoded = decodeSharedPathTargetVocab(row.targetVocab);
  return {
    id: row.id,
    tier: "pre-A1",
    stageId: row.stageId,
    stageOrder: row.stageOrder,
    pathIndex: row.pathIndex,
    title: row.title,
    teacherNote: row.teacherNote,
    activities: JSON.parse(row.activities) as UnitActivityRef[],
    richness: row.richness,
    approvalStatus: row.approvalStatus,
    provenance: row.provenance,
    targetVocab: decoded.words,
    ...(Object.keys(decoded.senses).length > 0 ? { targetVocabSenses: decoded.senses } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function parseQuestEntries(json: string): QuestProgressEntry[] {
  const raw = JSON.parse(json) as Array<{
    questId: string;
    progress: number;
    completedAt: string | null;
    lastCountedDay?: string | null;
  }>;
  return raw.map((e) => ({
    questId: e.questId,
    progress: e.progress,
    completedAt: e.completedAt ? new Date(e.completedAt) : null,
    lastCountedDay: e.lastCountedDay ?? null,
  }));
}

function serializeQuestEntries(entries: QuestProgressEntry[]): string {
  return JSON.stringify(
    entries.map((e) => ({
      questId: e.questId,
      progress: e.progress,
      completedAt: e.completedAt ? e.completedAt.toISOString() : null,
      ...(e.lastCountedDay != null ? { lastCountedDay: e.lastCountedDay } : {}),
    })),
  );
}

// ─── Row → domain mappers ──────────────────────────────────────────────────────

type CardRow = {
  id: number;
  userId: string;
  word: string;
  sense: string | null;
  definition: string;
  examples: string;
  cefr: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  fsrs: string;
  dueAt: Date;
  createdAt: Date;
  embedding: string | null;
  suspended: boolean;
};

function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    word: row.word,
    sense: row.sense ?? undefined,
    definition: row.definition,
    examples: JSON.parse(row.examples) as string[],
    cefr: row.cefr,
    fsrs: parseFsrs(row.fsrs),
    createdAt: row.createdAt,
    embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : undefined,
    suspended: row.suspended ? true : undefined,
  };
}

type ContentRow = {
  id: number;
  type: "passage" | "quiz" | "prompt" | "lesson";
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  topic: string;
  payload: string;
  source: "seed" | "generated" | "agent";
  validatedAt: Date;
  embedding: string | null;
};

function rowToContent(row: ContentRow): Content {
  return {
    id: row.id,
    type: row.type,
    level: row.level,
    topic: row.topic,
    payload: JSON.parse(row.payload) as unknown,
    source: row.source,
    validatedAt: row.validatedAt,
    embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : undefined,
  };
}

type ErrorEventRow = {
  id: number;
  userId: string;
  skill: "reading" | "writing" | "listening" | "speaking";
  category: string;
  cefr: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  context: string;
  createdAt: Date;
};

function rowToErrorEvent(row: ErrorEventRow): ErrorEventRecord {
  return {
    id: row.id,
    skill: row.skill,
    category: row.category,
    cefr: row.cefr,
    context: row.context,
    createdAt: row.createdAt,
  };
}

type UnitRow = {
  id: number;
  userId: string;
  index: number;
  title: string;
  teacherNote: string;
  targetGrammarIds: string;
  targetVocab: string;
  targetCefr: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  activities: string;
  status: "locked" | "available" | "in-progress" | "completed";
  bufferStatus: "empty" | "buffered";
  createdAt: Date;
};

function rowToUnit(row: UnitRow): Unit {
  return {
    id: row.id,
    index: row.index,
    title: row.title,
    teacherNote: row.teacherNote,
    targetGrammarIds: JSON.parse(row.targetGrammarIds) as string[],
    targetVocab: JSON.parse(row.targetVocab) as string[],
    targetCefr: row.targetCefr,
    activities: JSON.parse(row.activities) as UnitActivityRef[],
    status: row.status,
    bufferStatus: row.bufferStatus,
    createdAt: row.createdAt,
  };
}

// ─── Repository ────────────────────────────────────────────────────────────────

/**
 * Drizzle/SQLite implementation of {@link ContentRepository}. Server-side only —
 * constructed exclusively in a server composition root (`lib/db/server.ts`).
 *
 * Every per-user read/write is scoped by `userId`. Phase 1a uses the
 * {@link BOOTSTRAP_ADMIN_ID} stub; Phase 1b will wire a real session-resolved id.
 *
 * Settings merge: `profile.settings` (JSON column) stores all {@link ProfileSettings}
 * fields and is the authoritative source. The mac* infra fields are additionally
 * synced to `appConfig` so global defaults survive profile re-creation. When no
 * profile row exists yet (pre-onboarding), `getSettings()` falls back to `appConfig`.
 */
export class SqliteContentRepository implements ContentRepository {
  constructor(
    private readonly db: DrizzleClient,
    private readonly userId: string = BOOTSTRAP_ADMIN_ID,
  ) {}

  // ─── profile ─────────────────────────────────────────────────────────────

  async getProfile(): Promise<Profile | undefined> {
    const row = this.db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, this.userId))
      .get();
    if (!row) return undefined;
    return {
      cefrLevel: row.cefrLevel ?? undefined,
      goals: JSON.parse(row.goals) as Profile["goals"],
      createdAt: row.createdAt,
      settings: JSON.parse(row.settings) as ProfileSettings,
      experienceMode: row.experienceMode ?? undefined,
    };
  }

  async saveProfile(profile: Profile): Promise<void> {
    const settingsJson = JSON.stringify(profile.settings);
    const goalsJson = JSON.stringify(profile.goals);

    const existing = this.db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.userId, this.userId))
      .get();

    if (existing) {
      this.db
        .update(profilesTable)
        .set({
          cefrLevel: profile.cefrLevel,
          goals: goalsJson,
          createdAt: profile.createdAt,
          settings: settingsJson,
          experienceMode: profile.experienceMode,
        })
        .where(eq(profilesTable.userId, this.userId))
        .run();
    } else {
      this.db
        .insert(profilesTable)
        .values({
          userId: this.userId,
          cefrLevel: profile.cefrLevel,
          goals: goalsJson,
          createdAt: profile.createdAt,
          settings: settingsJson,
          experienceMode: profile.experienceMode,
        })
        .run();
    }

    this.syncMacFieldsToAppConfig(profile.settings);
  }

  // ─── settings ─────────────────────────────────────────────────────────────

  async getSettings(): Promise<ProfileSettings> {
    const profileRow = this.db
      .select({ settings: profilesTable.settings })
      .from(profilesTable)
      .where(eq(profilesTable.userId, this.userId))
      .get();

    if (profileRow) {
      return applyEnvFirstAiSettings(JSON.parse(profileRow.settings) as ProfileSettings);
    }

    // No profile yet — return global infra defaults from appConfig.
    const configRow = this.db.select().from(appConfig).where(eq(appConfig.id, APP_CONFIG_ID)).get();

    if (!configRow) return {};

    const settings: ProfileSettings = {};
    if (configRow.chatProvider) settings.chatProvider = configRow.chatProvider;
    if (configRow.chatModel) settings.chatModel = configRow.chatModel;
    if (configRow.sttProvider) settings.sttProvider = configRow.sttProvider;
    if (configRow.embeddingsProvider) settings.embeddingsProvider = configRow.embeddingsProvider;
    if (configRow.embeddingsModel) settings.embeddingsModel = configRow.embeddingsModel;
    if (configRow.macLlmBaseUrl) settings.macLlmBaseUrl = configRow.macLlmBaseUrl;
    if (configRow.macLlmModel) settings.macLlmModel = configRow.macLlmModel;
    if (configRow.macUtilityModel) settings.macUtilityModel = configRow.macUtilityModel;
    if (configRow.macEmbedModel) settings.macEmbedModel = configRow.macEmbedModel;
    if (configRow.macSttUrl) settings.macSttUrl = configRow.macSttUrl;
    return applyEnvFirstAiSettings(settings);
  }

  async saveSettings(settings: ProfileSettings): Promise<void> {
    const settingsJson = JSON.stringify(settings);

    const existing = this.db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.userId, this.userId))
      .get();

    if (existing) {
      this.db
        .update(profilesTable)
        .set({ settings: settingsJson })
        .where(eq(profilesTable.userId, this.userId))
        .run();
    } else {
      this.db
        .insert(profilesTable)
        .values({
          userId: this.userId,
          goals: "[]",
          createdAt: new Date(),
          settings: settingsJson,
        })
        .run();
    }

    this.syncMacFieldsToAppConfig(settings);
  }

  // ─── cards ────────────────────────────────────────────────────────────────

  async addCard(card: NewCard): Promise<number> {
    const result = this.db
      .insert(cardsTable)
      .values({
        userId: this.userId,
        word: card.word,
        sense: card.sense ?? null,
        definition: card.definition,
        examples: JSON.stringify(card.examples),
        cefr: card.cefr,
        fsrs: JSON.stringify(card.fsrs),
        dueAt: card.fsrs.due,
        createdAt: card.createdAt,
        embedding: card.embedding ? JSON.stringify(card.embedding) : null,
        suspended: card.suspended ?? false,
      })
      .run();
    return Number(result.lastInsertRowid);
  }

  async getCard(id: number): Promise<Card | undefined> {
    const row = this.db
      .select()
      .from(cardsTable)
      .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, this.userId)))
      .get();
    return row ? rowToCard(row) : undefined;
  }

  async getAllCards(): Promise<Card[]> {
    const rows = this.db.select().from(cardsTable).where(eq(cardsTable.userId, this.userId)).all();
    return rows.map(rowToCard);
  }

  async getDueCards(now: Date): Promise<Card[]> {
    const rows = this.db
      .select()
      .from(cardsTable)
      .where(
        and(
          eq(cardsTable.userId, this.userId),
          lte(cardsTable.dueAt, now),
          eq(cardsTable.suspended, false),
        ),
      )
      .orderBy(asc(cardsTable.dueAt))
      .all();
    return rows.map(rowToCard);
  }

  async updateCard(id: number, changes: Partial<NewCard>): Promise<void> {
    type CardUpdate = {
      word?: string;
      sense?: string | null;
      definition?: string;
      examples?: string;
      cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
      fsrs?: string;
      dueAt?: Date;
      createdAt?: Date;
      embedding?: string | null;
      suspended?: boolean;
    };
    const patch: CardUpdate = {};
    if (changes.word !== undefined) patch.word = changes.word;
    if (changes.sense !== undefined) patch.sense = changes.sense;
    if (changes.definition !== undefined) patch.definition = changes.definition;
    if (changes.examples !== undefined) patch.examples = JSON.stringify(changes.examples);
    if (changes.cefr !== undefined) patch.cefr = changes.cefr;
    if (changes.fsrs !== undefined) {
      patch.fsrs = JSON.stringify(changes.fsrs);
      patch.dueAt = changes.fsrs.due;
    }
    if (changes.createdAt !== undefined) patch.createdAt = changes.createdAt;
    if (changes.embedding !== undefined)
      patch.embedding = changes.embedding ? JSON.stringify(changes.embedding) : null;
    if (changes.suspended !== undefined) patch.suspended = changes.suspended;

    this.db
      .update(cardsTable)
      .set(patch)
      .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, this.userId)))
      .run();
  }

  async deleteCard(id: number): Promise<void> {
    this.db
      .delete(cardCollectionMembersTable)
      .where(
        and(
          eq(cardCollectionMembersTable.userId, this.userId),
          eq(cardCollectionMembersTable.cardId, id),
        ),
      )
      .run();
    this.db
      .delete(cardsTable)
      .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, this.userId)))
      .run();
  }

  async suspendCard(id: number): Promise<void> {
    await this.updateCard(id, { suspended: true });
  }

  async unsuspendCard(id: number): Promise<void> {
    await this.updateCard(id, { suspended: false });
  }

  async resetCardProgress(id: number, now = new Date()): Promise<void> {
    await this.updateCard(id, { fsrs: initCard(now) });
  }

  // ─── deck collections ───────────────────────────────────────────────────

  async addCollection(collection: NewCollection): Promise<number> {
    const result = this.db
      .insert(collectionsTable)
      .values({
        userId: this.userId,
        name: collection.name,
        kind: collection.kind,
      })
      .run();
    return Number(result.lastInsertRowid);
  }

  async renameCollection(id: number, name: string): Promise<void> {
    this.db
      .update(collectionsTable)
      .set({ name })
      .where(and(eq(collectionsTable.id, id), eq(collectionsTable.userId, this.userId)))
      .run();
  }

  async deleteCollection(id: number): Promise<void> {
    this.db
      .delete(cardCollectionMembersTable)
      .where(
        and(
          eq(cardCollectionMembersTable.userId, this.userId),
          eq(cardCollectionMembersTable.collectionId, id),
        ),
      )
      .run();
    this.db
      .delete(collectionsTable)
      .where(and(eq(collectionsTable.id, id), eq(collectionsTable.userId, this.userId)))
      .run();
  }

  async addCardToCollection(collectionId: number, cardId: number): Promise<void> {
    const existing = this.db
      .select()
      .from(cardCollectionMembersTable)
      .where(
        and(
          eq(cardCollectionMembersTable.userId, this.userId),
          eq(cardCollectionMembersTable.collectionId, collectionId),
          eq(cardCollectionMembersTable.cardId, cardId),
        ),
      )
      .get();
    if (existing) return;

    this.db
      .insert(cardCollectionMembersTable)
      .values({
        userId: this.userId,
        collectionId,
        cardId,
      })
      .run();
  }

  async removeCardFromCollection(collectionId: number, cardId: number): Promise<void> {
    this.db
      .delete(cardCollectionMembersTable)
      .where(
        and(
          eq(cardCollectionMembersTable.userId, this.userId),
          eq(cardCollectionMembersTable.collectionId, collectionId),
          eq(cardCollectionMembersTable.cardId, cardId),
        ),
      )
      .run();
  }

  async getCollections(): Promise<CollectionSummary[]> {
    const collectionRows = this.db
      .select()
      .from(collectionsTable)
      .where(eq(collectionsTable.userId, this.userId))
      .all();

    const memberRows = this.db
      .select()
      .from(cardCollectionMembersTable)
      .where(eq(cardCollectionMembersTable.userId, this.userId))
      .all();

    return collectionRows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      cardCount: memberRows.filter((member) => member.collectionId === row.id).length,
    }));
  }

  async getCollectionCards(collectionId: number): Promise<Card[]> {
    const memberRows = this.db
      .select({ cardId: cardCollectionMembersTable.cardId })
      .from(cardCollectionMembersTable)
      .where(
        and(
          eq(cardCollectionMembersTable.userId, this.userId),
          eq(cardCollectionMembersTable.collectionId, collectionId),
        ),
      )
      .all();

    if (memberRows.length === 0) return [];

    const cardIds = memberRows.map((row) => row.cardId);
    const rows = this.db
      .select()
      .from(cardsTable)
      .where(and(eq(cardsTable.userId, this.userId), inArray(cardsTable.id, cardIds)))
      .all();
    return rows.map(rowToCard);
  }

  // ─── content ──────────────────────────────────────────────────────────────

  async putContent(content: NewContent): Promise<number> {
    const result = this.db
      .insert(contentTable)
      .values({
        type: content.type,
        level: content.level,
        topic: content.topic,
        payload: JSON.stringify(content.payload),
        source: content.source,
        validatedAt: content.validatedAt,
        embedding: content.embedding ? JSON.stringify(content.embedding) : null,
      })
      .run();
    return Number(result.lastInsertRowid);
  }

  async getContent(id: number): Promise<Content | undefined> {
    const row = this.db.select().from(contentTable).where(eq(contentTable.id, id)).get();
    return row ? rowToContent(row) : undefined;
  }

  async queryContent(query: ContentQuery = {}): Promise<Content[]> {
    const { type, level, topic, source } = query;
    const conditions = [];
    if (type !== undefined) conditions.push(eq(contentTable.type, type));
    if (level !== undefined) conditions.push(eq(contentTable.level, level));
    if (topic !== undefined) conditions.push(eq(contentTable.topic, topic));
    if (source !== undefined) conditions.push(eq(contentTable.source, source));

    const rows =
      conditions.length > 0
        ? this.db
            .select()
            .from(contentTable)
            .where(and(...conditions))
            .all()
        : this.db.select().from(contentTable).all();

    return rows.map(rowToContent);
  }

  // ─── diagnostics ──────────────────────────────────────────────────────────

  async addErrorEvent(event: NewErrorEvent): Promise<number> {
    const result = this.db
      .insert(errorEventsTable)
      .values({
        userId: this.userId,
        skill: event.skill,
        category: event.category,
        cefr: event.cefr,
        context: event.context,
        createdAt: event.createdAt,
      })
      .run();
    return Number(result.lastInsertRowid);
  }

  async queryErrorEvents(query: ErrorEventQuery = {}): Promise<ErrorEventRecord[]> {
    const { skill, cefr, category } = query;
    const conditions = [eq(errorEventsTable.userId, this.userId)];
    if (skill !== undefined) conditions.push(eq(errorEventsTable.skill, skill));
    if (cefr !== undefined) conditions.push(eq(errorEventsTable.cefr, cefr));
    if (category !== undefined) conditions.push(eq(errorEventsTable.category, category));

    const rows = this.db
      .select()
      .from(errorEventsTable)
      .where(and(...conditions))
      .all();
    return rows.map(rowToErrorEvent);
  }

  // ─── weakness ─────────────────────────────────────────────────────────────

  async getWeaknesses(): Promise<Weakness[]> {
    const rows = this.db
      .select()
      .from(weaknessTable)
      .where(eq(weaknessTable.userId, this.userId))
      .all();
    return rows.map((row) => ({
      skill: row.skill,
      category: row.category,
      cefr: row.cefr,
      score: row.score,
      confidence: row.confidence,
      updatedAt: row.updatedAt,
    }));
  }

  async putWeakness(weakness: Weakness): Promise<void> {
    this.db
      .insert(weaknessTable)
      .values({
        userId: this.userId,
        skill: weakness.skill,
        category: weakness.category,
        cefr: weakness.cefr,
        score: weakness.score,
        confidence: weakness.confidence,
        updatedAt: weakness.updatedAt,
      })
      .onConflictDoUpdate({
        target: [
          weaknessTable.userId,
          weaknessTable.skill,
          weaknessTable.category,
          weaknessTable.cefr,
        ],
        set: {
          score: weakness.score,
          confidence: weakness.confidence,
          updatedAt: weakness.updatedAt,
        },
      })
      .run();
  }

  // ─── gamification ─────────────────────────────────────────────────────────

  async getGamification(): Promise<GamificationState | undefined> {
    const row = this.db
      .select()
      .from(gamificationTable)
      .where(eq(gamificationTable.userId, this.userId))
      .get();
    if (!row) return undefined;
    return {
      xp: row.xp,
      level: row.level,
      streakCount: row.streakCount,
      lastActivityDate: row.lastActivityDate ?? null,
      achievements: parseAchievements(row.achievements),
    };
  }

  async saveGamification(state: GamificationState): Promise<void> {
    const achievementsJson = JSON.stringify(state.achievements);

    const existing = this.db
      .select({ id: gamificationTable.id })
      .from(gamificationTable)
      .where(eq(gamificationTable.userId, this.userId))
      .get();

    if (existing) {
      this.db
        .update(gamificationTable)
        .set({
          xp: state.xp,
          level: state.level,
          streakCount: state.streakCount,
          lastActivityDate: state.lastActivityDate,
          achievements: achievementsJson,
        })
        .where(eq(gamificationTable.userId, this.userId))
        .run();
    } else {
      this.db
        .insert(gamificationTable)
        .values({
          userId: this.userId,
          xp: state.xp,
          level: state.level,
          streakCount: state.streakCount,
          lastActivityDate: state.lastActivityDate,
          achievements: achievementsJson,
        })
        .run();
    }
  }

  // ─── quest state ──────────────────────────────────────────────────────────

  async getQuestState(): Promise<QuestState | undefined> {
    const row = this.db
      .select()
      .from(questStateTable)
      .where(eq(questStateTable.userId, this.userId))
      .get();
    if (!row) return undefined;
    return {
      dailyPeriodStart: row.dailyPeriodStart ?? null,
      weeklyPeriodStart: row.weeklyPeriodStart ?? null,
      entries: parseQuestEntries(row.entries),
    };
  }

  async saveQuestState(state: QuestState): Promise<void> {
    const entriesJson = serializeQuestEntries(state.entries);

    const existing = this.db
      .select({ id: questStateTable.id })
      .from(questStateTable)
      .where(eq(questStateTable.userId, this.userId))
      .get();

    if (existing) {
      this.db
        .update(questStateTable)
        .set({
          dailyPeriodStart: state.dailyPeriodStart,
          weeklyPeriodStart: state.weeklyPeriodStart,
          entries: entriesJson,
        })
        .where(eq(questStateTable.userId, this.userId))
        .run();
    } else {
      this.db
        .insert(questStateTable)
        .values({
          userId: this.userId,
          dailyPeriodStart: state.dailyPeriodStart,
          weeklyPeriodStart: state.weeklyPeriodStart,
          entries: entriesJson,
        })
        .run();
    }
  }

  // ─── collectible grants ───────────────────────────────────────────────────

  async getCollectibles(): Promise<CollectibleGrant[]> {
    const rows = this.db
      .select()
      .from(collectibleGrantsTable)
      .where(eq(collectibleGrantsTable.userId, this.userId))
      .all();
    return rows.map((row) => ({
      collectibleId: row.collectibleId,
      unitId: row.unitId,
      grantedAt: row.grantedAt,
    }));
  }

  async grantCollectible(collectibleId: string, unitId: number, grantedAt: Date): Promise<void> {
    const existing = this.db
      .select({ collectibleId: collectibleGrantsTable.collectibleId })
      .from(collectibleGrantsTable)
      .where(
        and(
          eq(collectibleGrantsTable.userId, this.userId),
          eq(collectibleGrantsTable.collectibleId, collectibleId),
          eq(collectibleGrantsTable.unitId, unitId),
        ),
      )
      .get();
    if (existing) return;

    this.db
      .insert(collectibleGrantsTable)
      .values({
        userId: this.userId,
        collectibleId,
        unitId,
        grantedAt,
      })
      .run();
  }

  // ─── lexicon cache ────────────────────────────────────────────────────────

  async getLexiconEntry(word: string): Promise<LexiconCacheEntry | undefined> {
    const row = this.db
      .select()
      .from(lexiconCacheTable)
      .where(eq(lexiconCacheTable.word, word.toLowerCase()))
      .get();
    if (!row) return undefined;
    return {
      word: row.word,
      data: JSON.parse(row.data) as unknown,
      cachedAt: row.cachedAt,
    };
  }

  async putLexiconEntry(entry: LexiconCacheEntry): Promise<void> {
    this.db
      .insert(lexiconCacheTable)
      .values({
        word: entry.word.toLowerCase(),
        data: JSON.stringify(entry.data),
        cachedAt: entry.cachedAt,
      })
      .onConflictDoUpdate({
        target: lexiconCacheTable.word,
        set: {
          data: JSON.stringify(entry.data),
          cachedAt: entry.cachedAt,
        },
      })
      .run();
  }

  // ─── media assets ─────────────────────────────────────────────────────────

  async getMediaAsset(key: MediaAssetKey): Promise<MediaAsset | undefined> {
    const asset = await this.getMediaAssetRaw(key);
    if (!asset || asset.approvalStatus !== "approved") return undefined;
    return asset;
  }

  async getMediaAssetRaw(key: MediaAssetKey): Promise<MediaAsset | undefined> {
    const normalized = normalizeMediaAssetKey(key);
    const row = this.db
      .select()
      .from(mediaAssetsTable)
      .where(
        and(
          eq(mediaAssetsTable.kind, normalized.kind),
          eq(mediaAssetsTable.key, normalized.key),
          eq(mediaAssetsTable.style, normalized.style),
        ),
      )
      .get();
    if (!row) return undefined;
    return rowToMediaAsset(row);
  }

  async putMediaAsset(asset: MediaAsset): Promise<void> {
    const normalized = normalizeMediaAssetKey(asset);
    const prompt = asset.source === "generated" ? (asset.prompt ?? null) : null;
    this.db
      .insert(mediaAssetsTable)
      .values({
        kind: normalized.kind,
        key: normalized.key,
        style: normalized.style,
        mimeType: asset.mimeType,
        data: Buffer.from(asset.data),
        createdAt: asset.createdAt,
        source: asset.source,
        approvalStatus: asset.approvalStatus,
        prompt,
      })
      .onConflictDoUpdate({
        target: [mediaAssetsTable.kind, mediaAssetsTable.key, mediaAssetsTable.style],
        set: {
          mimeType: asset.mimeType,
          data: Buffer.from(asset.data),
          createdAt: asset.createdAt,
          source: asset.source,
          approvalStatus: asset.approvalStatus,
          prompt,
        },
      })
      .run();
  }

  async queryMediaAssets(query?: MediaAssetQuery): Promise<MediaAssetRecord[]> {
    const rows = this.db.select().from(mediaAssetsTable).all();
    return rows
      .filter((row) => (query?.kind ? row.kind === query.kind : true))
      .filter((row) => (query?.approvalStatus ? row.approvalStatus === query.approvalStatus : true))
      .map(rowToMediaAssetRecord);
  }

  async deleteMediaAsset(key: MediaAssetKey): Promise<void> {
    const normalized = normalizeMediaAssetKey(key);
    this.db
      .delete(mediaAssetsTable)
      .where(
        and(
          eq(mediaAssetsTable.kind, normalized.kind),
          eq(mediaAssetsTable.key, normalized.key),
          eq(mediaAssetsTable.style, normalized.style),
        ),
      )
      .run();
  }

  async approveMediaAsset(key: MediaAssetKey): Promise<void> {
    const asset = await this.getMediaAssetRaw(key);
    if (!asset) return;
    await this.putMediaAsset({ ...asset, approvalStatus: "approved" });
  }

  // ─── learning path units ──────────────────────────────────────────────────

  async addUnit(unit: NewUnit): Promise<number> {
    const result = this.db
      .insert(unitsTable)
      .values({
        userId: this.userId,
        index: unit.index,
        title: unit.title,
        teacherNote: unit.teacherNote,
        targetGrammarIds: JSON.stringify(unit.targetGrammarIds),
        targetVocab: JSON.stringify(unit.targetVocab),
        targetCefr: unit.targetCefr,
        activities: JSON.stringify(unit.activities),
        status: unit.status,
        bufferStatus: unit.bufferStatus,
        createdAt: unit.createdAt,
      })
      .run();
    return Number(result.lastInsertRowid);
  }

  async getUnits(): Promise<Unit[]> {
    const rows = this.db
      .select()
      .from(unitsTable)
      .where(eq(unitsTable.userId, this.userId))
      .orderBy(asc(unitsTable.index))
      .all();
    return rows.map(rowToUnit);
  }

  async updateUnit(id: number, changes: Partial<NewUnit>): Promise<void> {
    type UnitUpdate = {
      index?: number;
      title?: string;
      teacherNote?: string;
      targetGrammarIds?: string;
      targetVocab?: string;
      targetCefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
      activities?: string;
      status?: "locked" | "available" | "in-progress" | "completed";
      bufferStatus?: "empty" | "buffered";
      createdAt?: Date;
    };
    const patch: UnitUpdate = {};
    if (changes.index !== undefined) patch.index = changes.index;
    if (changes.title !== undefined) patch.title = changes.title;
    if (changes.teacherNote !== undefined) patch.teacherNote = changes.teacherNote;
    if (changes.targetGrammarIds !== undefined)
      patch.targetGrammarIds = JSON.stringify(changes.targetGrammarIds);
    if (changes.targetVocab !== undefined) patch.targetVocab = JSON.stringify(changes.targetVocab);
    if (changes.targetCefr !== undefined) patch.targetCefr = changes.targetCefr;
    if (changes.activities !== undefined) patch.activities = JSON.stringify(changes.activities);
    if (changes.status !== undefined) patch.status = changes.status;
    if (changes.bufferStatus !== undefined) patch.bufferStatus = changes.bufferStatus;
    if (changes.createdAt !== undefined) patch.createdAt = changes.createdAt;

    this.db
      .update(unitsTable)
      .set(patch)
      .where(and(eq(unitsTable.id, id), eq(unitsTable.userId, this.userId)))
      .run();
  }

  async deleteUnit(id: number): Promise<void> {
    this.db
      .delete(unitsTable)
      .where(and(eq(unitsTable.id, id), eq(unitsTable.userId, this.userId)))
      .run();
  }

  // ─── chapter mastery gates ────────────────────────────────────────────────

  async getChapterGate(tier: ChapterTier): Promise<ChapterGate | undefined> {
    const row = this.db
      .select()
      .from(chapterGatesTable)
      .where(and(eq(chapterGatesTable.userId, this.userId), eq(chapterGatesTable.tier, tier)))
      .get();
    if (!row) return undefined;
    return rowToChapterGate(row);
  }

  async saveChapterGate(gate: ChapterGate): Promise<void> {
    const existing = this.db
      .select({ tier: chapterGatesTable.tier })
      .from(chapterGatesTable)
      .where(and(eq(chapterGatesTable.userId, this.userId), eq(chapterGatesTable.tier, gate.tier)))
      .get();

    const reviewAssignmentJson =
      gate.reviewAssignment === undefined || gate.reviewAssignment === null
        ? null
        : JSON.stringify(gate.reviewAssignment);

    if (existing) {
      this.db
        .update(chapterGatesTable)
        .set({
          status: gate.status,
          updatedAt: gate.updatedAt,
          reviewAssignment: reviewAssignmentJson,
        })
        .where(
          and(eq(chapterGatesTable.userId, this.userId), eq(chapterGatesTable.tier, gate.tier)),
        )
        .run();
    } else {
      this.db
        .insert(chapterGatesTable)
        .values({
          userId: this.userId,
          tier: gate.tier,
          status: gate.status,
          updatedAt: gate.updatedAt,
          reviewAssignment: reviewAssignmentJson,
        })
        .run();
    }
  }

  // ─── shared path catalog ──────────────────────────────────────────────────

  async getSharedPathStages(): Promise<SharedPathStage[]> {
    const rows = this.db
      .select()
      .from(sharedPathStagesTable)
      .orderBy(asc(sharedPathStagesTable.order))
      .all();
    return rows.map(rowToSharedPathStage);
  }

  async putSharedPathStage(stage: SharedPathStage): Promise<void> {
    this.db
      .insert(sharedPathStagesTable)
      .values({
        id: stage.id,
        tier: stage.tier,
        title: stage.title,
        spineSectionKey: stage.spineSectionKey,
        order: stage.order,
        readyForExam: stage.readyForExam,
        updatedAt: stage.updatedAt,
      })
      .onConflictDoUpdate({
        target: sharedPathStagesTable.id,
        set: {
          tier: stage.tier,
          title: stage.title,
          spineSectionKey: stage.spineSectionKey,
          order: stage.order,
          readyForExam: stage.readyForExam,
          updatedAt: stage.updatedAt,
        },
      })
      .run();
  }

  async querySharedPathUnitTemplates(
    query?: SharedPathUnitTemplateQuery,
  ): Promise<SharedPathUnitTemplate[]> {
    let rows = this.db.select().from(sharedPathUnitTemplatesTable).all();
    if (query?.tier) rows = rows.filter((r) => r.tier === query.tier);
    if (query?.stageId) rows = rows.filter((r) => r.stageId === query.stageId);
    if (query?.approvalStatus) {
      rows = rows.filter((r) => r.approvalStatus === query.approvalStatus);
    }
    return rows.map(rowToSharedPathUnitTemplate).sort((a, b) => a.pathIndex - b.pathIndex);
  }

  async putSharedPathUnitTemplate(template: SharedPathUnitTemplate): Promise<void> {
    const activitiesJson = JSON.stringify(template.activities.map((a) => ({ skill: a.skill })));
    const targetVocabJson = encodeSharedPathTargetVocab(
      template.targetVocab,
      template.targetVocabSenses,
    );
    this.db
      .insert(sharedPathUnitTemplatesTable)
      .values({
        id: template.id,
        tier: template.tier,
        stageId: template.stageId,
        stageOrder: template.stageOrder,
        pathIndex: template.pathIndex,
        title: template.title,
        teacherNote: template.teacherNote,
        activities: activitiesJson,
        richness: template.richness,
        approvalStatus: template.approvalStatus,
        provenance: template.provenance,
        targetVocab: targetVocabJson,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      })
      .onConflictDoUpdate({
        target: sharedPathUnitTemplatesTable.id,
        set: {
          tier: template.tier,
          stageId: template.stageId,
          stageOrder: template.stageOrder,
          pathIndex: template.pathIndex,
          title: template.title,
          teacherNote: template.teacherNote,
          activities: activitiesJson,
          richness: template.richness,
          approvalStatus: template.approvalStatus,
          provenance: template.provenance,
          targetVocab: targetVocabJson,
          updatedAt: template.updatedAt,
        },
      })
      .run();
  }

  async deleteSharedPathUnitTemplate(id: string): Promise<void> {
    this.db
      .delete(sharedPathUnitTemplatesTable)
      .where(eq(sharedPathUnitTemplatesTable.id, id))
      .run();
  }

  // ─── maintenance ──────────────────────────────────────────────────────────

  async clear(): Promise<void> {
    this.db.delete(profilesTable).where(eq(profilesTable.userId, this.userId)).run();
    this.db.delete(cardsTable).where(eq(cardsTable.userId, this.userId)).run();
    this.db.delete(collectionsTable).where(eq(collectionsTable.userId, this.userId)).run();
    this.db
      .delete(cardCollectionMembersTable)
      .where(eq(cardCollectionMembersTable.userId, this.userId))
      .run();
    this.db.delete(contentTable).run();
    this.db.delete(errorEventsTable).where(eq(errorEventsTable.userId, this.userId)).run();
    this.db.delete(weaknessTable).where(eq(weaknessTable.userId, this.userId)).run();
    this.db.delete(gamificationTable).where(eq(gamificationTable.userId, this.userId)).run();
    this.db.delete(questStateTable).where(eq(questStateTable.userId, this.userId)).run();
    this.db
      .delete(collectibleGrantsTable)
      .where(eq(collectibleGrantsTable.userId, this.userId))
      .run();
    this.db.delete(chapterGatesTable).where(eq(chapterGatesTable.userId, this.userId)).run();
    this.db.delete(lexiconCacheTable).run();
    this.db.delete(mediaAssetsTable).run();
    this.db.delete(sharedPathStagesTable).run();
    this.db.delete(sharedPathUnitTemplatesTable).run();
    this.db.delete(unitsTable).where(eq(unitsTable.userId, this.userId)).run();
  }

  // ─── backup ───────────────────────────────────────────────────────────────

  async exportBackup(): Promise<BackupData> {
    const profileRows = this.db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, this.userId))
      .all();

    const cardRows = this.db
      .select()
      .from(cardsTable)
      .where(eq(cardsTable.userId, this.userId))
      .all();

    const contentRows = this.db.select().from(contentTable).all();

    const errorEventRows = this.db
      .select()
      .from(errorEventsTable)
      .where(eq(errorEventsTable.userId, this.userId))
      .all();

    const weaknessRows = this.db
      .select()
      .from(weaknessTable)
      .where(eq(weaknessTable.userId, this.userId))
      .all();

    const gamificationRows = this.db
      .select()
      .from(gamificationTable)
      .where(eq(gamificationTable.userId, this.userId))
      .all();

    const lexiconRows = this.db.select().from(lexiconCacheTable).all();

    const unitRows = this.db
      .select()
      .from(unitsTable)
      .where(eq(unitsTable.userId, this.userId))
      .all();

    return {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      tables: {
        profile: profileRows.map((row) => ({
          id: 1 as const,
          cefrLevel: row.cefrLevel ?? undefined,
          goals: JSON.parse(row.goals) as Profile["goals"],
          createdAt: row.createdAt,
          settings: JSON.parse(row.settings) as ProfileSettings,
          experienceMode: row.experienceMode ?? undefined,
        })),
        cards: cardRows.map((row) => ({
          id: row.id,
          word: row.word,
          sense: row.sense ?? undefined,
          definition: row.definition,
          examples: JSON.parse(row.examples) as string[],
          cefr: row.cefr,
          fsrs: parseFsrs(row.fsrs),
          createdAt: row.createdAt,
          embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : undefined,
        })),
        content: contentRows.map((row) => ({
          id: row.id,
          type: row.type,
          level: row.level,
          topic: row.topic,
          payload: JSON.parse(row.payload) as unknown,
          source: row.source,
          validatedAt: row.validatedAt,
          embedding: row.embedding ? (JSON.parse(row.embedding) as number[]) : undefined,
        })),
        errorEvents: errorEventRows.map((row) => ({
          id: row.id,
          skill: row.skill,
          category: row.category,
          cefr: row.cefr,
          context: row.context,
          createdAt: row.createdAt,
        })),
        weakness: weaknessRows.map((row) => ({
          skill: row.skill,
          category: row.category,
          cefr: row.cefr,
          score: row.score,
          confidence: row.confidence,
          updatedAt: row.updatedAt,
        })),
        gamification: gamificationRows.map((row) => ({
          id: 1 as const,
          xp: row.xp,
          level: row.level,
          streakCount: row.streakCount,
          lastActivityDate: row.lastActivityDate ?? null,
          achievements: parseAchievements(row.achievements),
        })),
        lexiconCache: lexiconRows.map((row) => ({
          word: row.word,
          data: JSON.parse(row.data) as unknown,
          cachedAt: row.cachedAt,
        })),
        units: unitRows.map(rowToUnit),
      },
    };
  }

  async importBackup(data: BackupData): Promise<void> {
    // Clear only this user's per-user data. Shared tables (content, lexiconCache) are
    // merged via upsert below so other users' data is not disturbed.
    this.db.delete(profilesTable).where(eq(profilesTable.userId, this.userId)).run();
    this.db.delete(cardsTable).where(eq(cardsTable.userId, this.userId)).run();
    this.db.delete(errorEventsTable).where(eq(errorEventsTable.userId, this.userId)).run();
    this.db.delete(weaknessTable).where(eq(weaknessTable.userId, this.userId)).run();
    this.db.delete(gamificationTable).where(eq(gamificationTable.userId, this.userId)).run();
    this.db.delete(unitsTable).where(eq(unitsTable.userId, this.userId)).run();

    for (const row of data.tables.profile) {
      this.db
        .insert(profilesTable)
        .values({
          userId: this.userId,
          cefrLevel: row.cefrLevel,
          goals: JSON.stringify(row.goals),
          createdAt: row.createdAt,
          settings: JSON.stringify(row.settings),
          experienceMode: row.experienceMode,
        })
        .run();
    }

    for (const card of data.tables.cards) {
      // Omit id — let SQLite auto-assign to avoid PK conflicts with other users' cards.
      this.db
        .insert(cardsTable)
        .values({
          userId: this.userId,
          word: card.word,
          sense: card.sense ?? null,
          definition: card.definition,
          examples: JSON.stringify(card.examples),
          cefr: card.cefr,
          fsrs: JSON.stringify(card.fsrs),
          dueAt: card.fsrs.due,
          createdAt: card.createdAt,
          embedding: card.embedding ? JSON.stringify(card.embedding) : null,
        })
        .run();
    }

    for (const c of data.tables.content) {
      this.db
        .insert(contentTable)
        .values({
          id: c.id,
          type: c.type,
          level: c.level,
          topic: c.topic,
          payload: JSON.stringify(c.payload),
          source: c.source,
          validatedAt: c.validatedAt,
          embedding: c.embedding ? JSON.stringify(c.embedding) : null,
        })
        .onConflictDoUpdate({
          target: contentTable.id,
          set: {
            type: c.type,
            level: c.level,
            topic: c.topic,
            payload: JSON.stringify(c.payload),
            source: c.source,
            validatedAt: c.validatedAt,
            embedding: c.embedding ? JSON.stringify(c.embedding) : null,
          },
        })
        .run();
    }

    for (const ev of data.tables.errorEvents) {
      // Omit id — let SQLite auto-assign to avoid PK conflicts with other users' rows.
      this.db
        .insert(errorEventsTable)
        .values({
          userId: this.userId,
          skill: ev.skill,
          category: ev.category,
          cefr: ev.cefr,
          context: ev.context,
          createdAt: ev.createdAt,
        })
        .run();
    }

    for (const w of data.tables.weakness) {
      this.db
        .insert(weaknessTable)
        .values({
          userId: this.userId,
          skill: w.skill,
          category: w.category,
          cefr: w.cefr,
          score: w.score,
          confidence: w.confidence,
          updatedAt: w.updatedAt,
        })
        .run();
    }

    for (const g of data.tables.gamification) {
      this.db
        .insert(gamificationTable)
        .values({
          userId: this.userId,
          xp: g.xp,
          level: g.level,
          streakCount: g.streakCount,
          lastActivityDate: g.lastActivityDate,
          achievements: JSON.stringify(g.achievements),
        })
        .run();
    }

    for (const lex of data.tables.lexiconCache) {
      this.db
        .insert(lexiconCacheTable)
        .values({
          word: lex.word,
          data: JSON.stringify(lex.data),
          cachedAt: lex.cachedAt,
        })
        .onConflictDoUpdate({
          target: lexiconCacheTable.word,
          set: {
            data: JSON.stringify(lex.data),
            cachedAt: lex.cachedAt,
          },
        })
        .run();
    }

    // Old-format backups (pre-#57) have no `units` key — default to empty.
    for (const u of data.tables.units ?? []) {
      this.db
        .insert(unitsTable)
        .values({
          userId: this.userId,
          index: u.index,
          title: u.title,
          teacherNote: u.teacherNote,
          targetGrammarIds: JSON.stringify(u.targetGrammarIds),
          targetVocab: JSON.stringify(u.targetVocab),
          targetCefr: u.targetCefr,
          activities: JSON.stringify(u.activities),
          status: u.status,
          bufferStatus: u.bufferStatus,
          createdAt: u.createdAt,
        })
        .run();
    }
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  private syncMacFieldsToAppConfig(settings: ProfileSettings): void {
    const hasMacFields =
      settings.chatProvider !== undefined ||
      settings.chatModel !== undefined ||
      settings.sttProvider !== undefined ||
      settings.embeddingsProvider !== undefined ||
      settings.embeddingsModel !== undefined ||
      settings.macLlmBaseUrl !== undefined ||
      settings.macLlmModel !== undefined ||
      settings.macUtilityModel !== undefined ||
      settings.macEmbedModel !== undefined ||
      settings.macSttUrl !== undefined;

    if (!hasMacFields) return;

    const existing = this.db.select().from(appConfig).where(eq(appConfig.id, APP_CONFIG_ID)).get();

    if (existing) {
      const cloudMode = env.LANGTUTOR_MODE === "cloud";
      this.db
        .update(appConfig)
        .set({
          chatProvider: cloudMode ? "groq" : (settings.chatProvider ?? existing.chatProvider),
          chatModel: cloudMode
            ? env.GROQ_CHAT_MODEL?.trim() ||
              settings.chatModel ||
              existing.chatModel ||
              DEFAULT_GROQ_CHAT_MODEL
            : (settings.chatModel ?? existing.chatModel),
          sttProvider: cloudMode ? "groq" : (settings.sttProvider ?? existing.sttProvider),
          embeddingsProvider: cloudMode
            ? "mistral"
            : (settings.embeddingsProvider ?? existing.embeddingsProvider),
          embeddingsModel: cloudMode
            ? env.MISTRAL_EMBED_MODEL?.trim() ||
              settings.embeddingsModel ||
              existing.embeddingsModel ||
              DEFAULT_MISTRAL_EMBED_MODEL
            : (settings.embeddingsModel ?? existing.embeddingsModel),
          macLlmBaseUrl: settings.macLlmBaseUrl ?? existing.macLlmBaseUrl,
          macLlmModel: settings.macLlmModel ?? existing.macLlmModel,
          macUtilityModel: settings.macUtilityModel ?? existing.macUtilityModel,
          macEmbedModel: settings.macEmbedModel ?? existing.macEmbedModel,
          macSttUrl: settings.macSttUrl ?? existing.macSttUrl,
          updatedAt: new Date(),
        })
        .where(eq(appConfig.id, APP_CONFIG_ID))
        .run();
    } else {
      const cloudMode = env.LANGTUTOR_MODE === "cloud";
      this.db
        .insert(appConfig)
        .values({
          id: APP_CONFIG_ID,
          chatProvider: cloudMode ? "groq" : (settings.chatProvider ?? "mac"),
          chatModel: cloudMode
            ? env.GROQ_CHAT_MODEL?.trim() || settings.chatModel || DEFAULT_GROQ_CHAT_MODEL
            : (settings.chatModel ?? ""),
          sttProvider: cloudMode ? "groq" : (settings.sttProvider ?? "mac"),
          embeddingsProvider: cloudMode ? "mistral" : (settings.embeddingsProvider ?? "mac"),
          embeddingsModel: cloudMode
            ? env.MISTRAL_EMBED_MODEL?.trim() ||
              settings.embeddingsModel ||
              DEFAULT_MISTRAL_EMBED_MODEL
            : (settings.embeddingsModel ?? ""),
          macLlmBaseUrl: settings.macLlmBaseUrl ?? "",
          macLlmModel: settings.macLlmModel ?? "",
          macUtilityModel: settings.macUtilityModel ?? "",
          macEmbedModel: settings.macEmbedModel ?? "",
          macSttUrl: settings.macSttUrl ?? "",
          updatedAt: new Date(),
        })
        .run();
    }
  }
}
