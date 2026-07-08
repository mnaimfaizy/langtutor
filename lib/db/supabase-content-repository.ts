import "server-only";

import { and, asc, eq, lte } from "drizzle-orm";

import { env } from "@/lib/config/env";

import type { BackupData } from "../backup/schema";
import type {
  ContentQuery,
  ContentRepository,
  ErrorEventQuery,
  MediaAssetQuery,
  NewCard,
  NewContent,
  NewErrorEvent,
  NewUnit,
} from "./content-repository";
import type { PostgresDrizzleClient } from "./drizzle/postgres-client";
import { withUserRlsScope, type PostgresDrizzleScope } from "./drizzle/postgres-rls-scope";
import {
  BOOTSTRAP_ADMIN_ID,
  appConfig,
  cards as cardsTable,
  content as contentTable,
  errorEvents as errorEventsTable,
  gamification as gamificationTable,
  lexiconCache as lexiconCacheTable,
  mediaAssets as mediaAssetsTable,
  collectibleGrants as collectibleGrantsTable,
  questState as questStateTable,
  profiles as profilesTable,
  units as unitsTable,
  weakness as weaknessTable,
} from "./drizzle/schema.postgres";
import type {
  Achievement,
  Card,
  CollectibleGrant,
  Content,
  ErrorEventRecord,
  FsrsState,
  GamificationState,
  LexiconCacheEntry,
  MediaAsset,
  MediaAssetKey,
  MediaAssetRecord,
  Profile,
  ProfileSettings,
  QuestProgressEntry,
  QuestState,
  Unit,
  UnitActivityRef,
  Weakness,
} from "./schema";

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
    data: bufferToUint8Array(row.data as Buffer),
    createdAt: row.createdAt,
    source: row.source,
    approvalStatus: row.approvalStatus,
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

function parseQuestEntries(json: string): QuestProgressEntry[] {
  const raw = JSON.parse(json) as Array<{
    questId: string;
    progress: number;
    completedAt: string | null;
  }>;
  return raw.map((e) => ({
    questId: e.questId,
    progress: e.progress,
    completedAt: e.completedAt ? new Date(e.completedAt) : null,
  }));
}

function serializeQuestEntries(entries: QuestProgressEntry[]): string {
  return JSON.stringify(
    entries.map((e) => ({
      questId: e.questId,
      progress: e.progress,
      completedAt: e.completedAt ? e.completedAt.toISOString() : null,
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
 * Drizzle/Postgres implementation of {@link ContentRepository}. Server-side only —
 * constructed exclusively in a server composition root (`lib/db/server.ts`).
 *
 * Every per-user read/write is scoped by `userId` via Drizzle `.where()` clauses
 * (app-enforced scoping; ADR 0003) and wrapped in a transaction that injects
 * `request.jwt.claim.sub` for Postgres RLS (ADR 0009).
 */
export class SupabaseContentRepository implements ContentRepository {
  constructor(
    private readonly db: PostgresDrizzleClient,
    private readonly userId: string = BOOTSTRAP_ADMIN_ID,
  ) {}

  private scoped<T>(fn: (db: PostgresDrizzleScope) => Promise<T>): Promise<T> {
    return withUserRlsScope(this.db, this.userId, fn);
  }

  // ─── profile ─────────────────────────────────────────────────────────────

  async getProfile(): Promise<Profile | undefined> {
    return this.scoped(async (db) => {
      const rows = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, this.userId))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return {
        cefrLevel: row.cefrLevel ?? undefined,
        goals: JSON.parse(row.goals) as Profile["goals"],
        createdAt: row.createdAt,
        settings: JSON.parse(row.settings) as ProfileSettings,
        experienceMode: row.experienceMode ?? undefined,
      };
    });
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.scoped(async (db) => {
      const settingsJson = JSON.stringify(profile.settings);
      const goalsJson = JSON.stringify(profile.goals);

      const existing = await db
        .select({ id: profilesTable.id })
        .from(profilesTable)
        .where(eq(profilesTable.userId, this.userId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(profilesTable)
          .set({
            cefrLevel: profile.cefrLevel,
            goals: goalsJson,
            createdAt: profile.createdAt,
            settings: settingsJson,
            experienceMode: profile.experienceMode,
          })
          .where(eq(profilesTable.userId, this.userId));
      } else {
        await db.insert(profilesTable).values({
          userId: this.userId,
          cefrLevel: profile.cefrLevel,
          goals: goalsJson,
          createdAt: profile.createdAt,
          settings: settingsJson,
          experienceMode: profile.experienceMode,
        });
      }

      await this.syncMacFieldsToAppConfig(db, profile.settings);
    });
  }

  // ─── settings ─────────────────────────────────────────────────────────────

  async getSettings(): Promise<ProfileSettings> {
    return this.scoped(async (db) => {
      const profileRows = await db
        .select({ settings: profilesTable.settings })
        .from(profilesTable)
        .where(eq(profilesTable.userId, this.userId))
        .limit(1);

      const profileRow = profileRows[0];
      if (profileRow) {
        return applyEnvFirstAiSettings(JSON.parse(profileRow.settings) as ProfileSettings);
      }

      const configRows = await db
        .select()
        .from(appConfig)
        .where(eq(appConfig.id, APP_CONFIG_ID))
        .limit(1);

      const configRow = configRows[0];
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
    });
  }

  async saveSettings(settings: ProfileSettings): Promise<void> {
    await this.scoped(async (db) => {
      const settingsJson = JSON.stringify(settings);

      const existing = await db
        .select({ id: profilesTable.id })
        .from(profilesTable)
        .where(eq(profilesTable.userId, this.userId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(profilesTable)
          .set({ settings: settingsJson })
          .where(eq(profilesTable.userId, this.userId));
      } else {
        await db.insert(profilesTable).values({
          userId: this.userId,
          goals: "[]",
          createdAt: new Date(),
          settings: settingsJson,
        });
      }

      await this.syncMacFieldsToAppConfig(db, settings);
    });
  }

  // ─── cards ────────────────────────────────────────────────────────────────

  async addCard(card: NewCard): Promise<number> {
    return this.scoped(async (db) => {
      const inserted = await db
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
        .returning({ id: cardsTable.id });
      return inserted[0]!.id;
    });
  }

  async getCard(id: number): Promise<Card | undefined> {
    return this.scoped(async (db) => {
      const rows = await db
        .select()
        .from(cardsTable)
        .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, this.userId)))
        .limit(1);
      const row = rows[0];
      return row ? rowToCard(row) : undefined;
    });
  }

  async getAllCards(): Promise<Card[]> {
    return this.scoped(async (db) => {
      const rows = await db.select().from(cardsTable).where(eq(cardsTable.userId, this.userId));
      return rows.map(rowToCard);
    });
  }

  async getDueCards(now: Date): Promise<Card[]> {
    return this.scoped(async (db) => {
      const rows = await db
        .select()
        .from(cardsTable)
        .where(and(eq(cardsTable.userId, this.userId), lte(cardsTable.dueAt, now)))
        .orderBy(asc(cardsTable.dueAt));
      return rows.map(rowToCard);
    });
  }

  async updateCard(id: number, changes: Partial<NewCard>): Promise<void> {
    await this.scoped(async (db) => {
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

      await db
        .update(cardsTable)
        .set(patch)
        .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, this.userId)));
    });
  }

  async deleteCard(id: number): Promise<void> {
    await this.scoped(async (db) => {
      await db
        .delete(cardsTable)
        .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, this.userId)));
    });
  }

  // ─── content ──────────────────────────────────────────────────────────────

  async putContent(content: NewContent): Promise<number> {
    return this.scoped(async (db) => {
      const inserted = await db
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
        .returning({ id: contentTable.id });
      return inserted[0]!.id;
    });
  }

  async getContent(id: number): Promise<Content | undefined> {
    return this.scoped(async (db) => {
      const rows = await db.select().from(contentTable).where(eq(contentTable.id, id)).limit(1);
      const row = rows[0];
      return row ? rowToContent(row) : undefined;
    });
  }

  async queryContent(query: ContentQuery = {}): Promise<Content[]> {
    return this.scoped(async (db) => {
      const { type, level, topic, source } = query;
      const conditions = [];
      if (type !== undefined) conditions.push(eq(contentTable.type, type));
      if (level !== undefined) conditions.push(eq(contentTable.level, level));
      if (topic !== undefined) conditions.push(eq(contentTable.topic, topic));
      if (source !== undefined) conditions.push(eq(contentTable.source, source));

      const rows =
        conditions.length > 0
          ? await db
              .select()
              .from(contentTable)
              .where(and(...conditions))
          : await db.select().from(contentTable);

      return rows.map(rowToContent);
    });
  }

  // ─── diagnostics ──────────────────────────────────────────────────────────

  async addErrorEvent(event: NewErrorEvent): Promise<number> {
    return this.scoped(async (db) => {
      const inserted = await db
        .insert(errorEventsTable)
        .values({
          userId: this.userId,
          skill: event.skill,
          category: event.category,
          cefr: event.cefr,
          context: event.context,
          createdAt: event.createdAt,
        })
        .returning({ id: errorEventsTable.id });
      return inserted[0]!.id;
    });
  }

  async queryErrorEvents(query: ErrorEventQuery = {}): Promise<ErrorEventRecord[]> {
    return this.scoped(async (db) => {
      const { skill, cefr, category } = query;
      const conditions = [eq(errorEventsTable.userId, this.userId)];
      if (skill !== undefined) conditions.push(eq(errorEventsTable.skill, skill));
      if (cefr !== undefined) conditions.push(eq(errorEventsTable.cefr, cefr));
      if (category !== undefined) conditions.push(eq(errorEventsTable.category, category));

      const rows = await db
        .select()
        .from(errorEventsTable)
        .where(and(...conditions));
      return rows.map(rowToErrorEvent);
    });
  }

  // ─── weakness ─────────────────────────────────────────────────────────────

  async getWeaknesses(): Promise<Weakness[]> {
    return this.scoped(async (db) => {
      const rows = await db
        .select()
        .from(weaknessTable)
        .where(eq(weaknessTable.userId, this.userId));
      return rows.map((row) => ({
        skill: row.skill,
        category: row.category,
        cefr: row.cefr,
        score: row.score,
        confidence: row.confidence,
        updatedAt: row.updatedAt,
      }));
    });
  }

  async putWeakness(weakness: Weakness): Promise<void> {
    await this.scoped(async (db) => {
      await db
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
        });
    });
  }

  // ─── gamification ─────────────────────────────────────────────────────────

  async getGamification(): Promise<GamificationState | undefined> {
    return this.scoped(async (db) => {
      const rows = await db
        .select()
        .from(gamificationTable)
        .where(eq(gamificationTable.userId, this.userId))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return {
        xp: row.xp,
        level: row.level,
        streakCount: row.streakCount,
        lastActivityDate: row.lastActivityDate ?? null,
        achievements: parseAchievements(row.achievements),
      };
    });
  }

  async saveGamification(state: GamificationState): Promise<void> {
    await this.scoped(async (db) => {
      const achievementsJson = JSON.stringify(state.achievements);

      const existing = await db
        .select({ id: gamificationTable.id })
        .from(gamificationTable)
        .where(eq(gamificationTable.userId, this.userId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(gamificationTable)
          .set({
            xp: state.xp,
            level: state.level,
            streakCount: state.streakCount,
            lastActivityDate: state.lastActivityDate,
            achievements: achievementsJson,
          })
          .where(eq(gamificationTable.userId, this.userId));
      } else {
        await db.insert(gamificationTable).values({
          userId: this.userId,
          xp: state.xp,
          level: state.level,
          streakCount: state.streakCount,
          lastActivityDate: state.lastActivityDate,
          achievements: achievementsJson,
        });
      }
    });
  }

  // ─── quest state ──────────────────────────────────────────────────────────

  async getQuestState(): Promise<QuestState | undefined> {
    return this.scoped(async (db) => {
      const rows = await db
        .select()
        .from(questStateTable)
        .where(eq(questStateTable.userId, this.userId))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return {
        dailyPeriodStart: row.dailyPeriodStart ?? null,
        weeklyPeriodStart: row.weeklyPeriodStart ?? null,
        entries: parseQuestEntries(row.entries),
      };
    });
  }

  async saveQuestState(state: QuestState): Promise<void> {
    await this.scoped(async (db) => {
      const entriesJson = serializeQuestEntries(state.entries);

      const existing = await db
        .select({ id: questStateTable.id })
        .from(questStateTable)
        .where(eq(questStateTable.userId, this.userId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(questStateTable)
          .set({
            dailyPeriodStart: state.dailyPeriodStart,
            weeklyPeriodStart: state.weeklyPeriodStart,
            entries: entriesJson,
          })
          .where(eq(questStateTable.userId, this.userId));
      } else {
        await db.insert(questStateTable).values({
          userId: this.userId,
          dailyPeriodStart: state.dailyPeriodStart,
          weeklyPeriodStart: state.weeklyPeriodStart,
          entries: entriesJson,
        });
      }
    });
  }

  // ─── collectible grants ───────────────────────────────────────────────────

  async getCollectibles(): Promise<CollectibleGrant[]> {
    return this.scoped(async (db) => {
      const rows = await db
        .select()
        .from(collectibleGrantsTable)
        .where(eq(collectibleGrantsTable.userId, this.userId));
      return rows.map((row) => ({
        collectibleId: row.collectibleId,
        unitId: row.unitId,
        grantedAt: row.grantedAt,
      }));
    });
  }

  async grantCollectible(collectibleId: string, unitId: number, grantedAt: Date): Promise<void> {
    await this.scoped(async (db) => {
      const existing = await db
        .select({ collectibleId: collectibleGrantsTable.collectibleId })
        .from(collectibleGrantsTable)
        .where(
          and(
            eq(collectibleGrantsTable.userId, this.userId),
            eq(collectibleGrantsTable.collectibleId, collectibleId),
            eq(collectibleGrantsTable.unitId, unitId),
          ),
        )
        .limit(1);
      if (existing[0]) return;

      await db.insert(collectibleGrantsTable).values({
        userId: this.userId,
        collectibleId,
        unitId,
        grantedAt,
      });
    });
  }

  // ─── lexicon cache ────────────────────────────────────────────────────────

  async getLexiconEntry(word: string): Promise<LexiconCacheEntry | undefined> {
    return this.scoped(async (db) => {
      const rows = await db
        .select()
        .from(lexiconCacheTable)
        .where(eq(lexiconCacheTable.word, word.toLowerCase()))
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return {
        word: row.word,
        data: JSON.parse(row.data) as unknown,
        cachedAt: row.cachedAt,
      };
    });
  }

  async putLexiconEntry(entry: LexiconCacheEntry): Promise<void> {
    await this.scoped(async (db) => {
      await db
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
        });
    });
  }

  // ─── media assets ─────────────────────────────────────────────────────────

  async getMediaAsset(key: MediaAssetKey): Promise<MediaAsset | undefined> {
    const asset = await this.getMediaAssetRaw(key);
    if (!asset || asset.approvalStatus !== "approved") return undefined;
    return asset;
  }

  async getMediaAssetRaw(key: MediaAssetKey): Promise<MediaAsset | undefined> {
    return this.scoped(async (db) => {
      const normalized = normalizeMediaAssetKey(key);
      const rows = await db
        .select()
        .from(mediaAssetsTable)
        .where(
          and(
            eq(mediaAssetsTable.kind, normalized.kind),
            eq(mediaAssetsTable.key, normalized.key),
            eq(mediaAssetsTable.style, normalized.style),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) return undefined;
      return rowToMediaAsset(row);
    });
  }

  async putMediaAsset(asset: MediaAsset): Promise<void> {
    await this.scoped(async (db) => {
      const normalized = normalizeMediaAssetKey(asset);
      await db
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
        })
        .onConflictDoUpdate({
          target: [mediaAssetsTable.kind, mediaAssetsTable.key, mediaAssetsTable.style],
          set: {
            mimeType: asset.mimeType,
            data: Buffer.from(asset.data),
            createdAt: asset.createdAt,
            source: asset.source,
            approvalStatus: asset.approvalStatus,
          },
        });
    });
  }

  async queryMediaAssets(query?: MediaAssetQuery): Promise<MediaAssetRecord[]> {
    return this.scoped(async (db) => {
      const rows = await db.select().from(mediaAssetsTable);
      return rows
        .filter((row) => (query?.kind ? row.kind === query.kind : true))
        .filter((row) =>
          query?.approvalStatus ? row.approvalStatus === query.approvalStatus : true,
        )
        .map(rowToMediaAssetRecord);
    });
  }

  async deleteMediaAsset(key: MediaAssetKey): Promise<void> {
    await this.scoped(async (db) => {
      const normalized = normalizeMediaAssetKey(key);
      await db
        .delete(mediaAssetsTable)
        .where(
          and(
            eq(mediaAssetsTable.kind, normalized.kind),
            eq(mediaAssetsTable.key, normalized.key),
            eq(mediaAssetsTable.style, normalized.style),
          ),
        );
    });
  }

  async approveMediaAsset(key: MediaAssetKey): Promise<void> {
    const asset = await this.getMediaAssetRaw(key);
    if (!asset) return;
    await this.putMediaAsset({ ...asset, approvalStatus: "approved" });
  }

  // ─── learning path units ──────────────────────────────────────────────────

  async addUnit(unit: NewUnit): Promise<number> {
    return this.scoped(async (db) => {
      const inserted = await db
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
        .returning({ id: unitsTable.id });
      return inserted[0]!.id;
    });
  }

  async getUnits(): Promise<Unit[]> {
    return this.scoped(async (db) => {
      const rows = await db
        .select()
        .from(unitsTable)
        .where(eq(unitsTable.userId, this.userId))
        .orderBy(asc(unitsTable.index));
      return rows.map(rowToUnit);
    });
  }

  async updateUnit(id: number, changes: Partial<NewUnit>): Promise<void> {
    await this.scoped(async (db) => {
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
      if (changes.targetVocab !== undefined)
        patch.targetVocab = JSON.stringify(changes.targetVocab);
      if (changes.targetCefr !== undefined) patch.targetCefr = changes.targetCefr;
      if (changes.activities !== undefined) patch.activities = JSON.stringify(changes.activities);
      if (changes.status !== undefined) patch.status = changes.status;
      if (changes.bufferStatus !== undefined) patch.bufferStatus = changes.bufferStatus;
      if (changes.createdAt !== undefined) patch.createdAt = changes.createdAt;

      await db
        .update(unitsTable)
        .set(patch)
        .where(and(eq(unitsTable.id, id), eq(unitsTable.userId, this.userId)));
    });
  }

  async deleteUnit(id: number): Promise<void> {
    await this.scoped(async (db) => {
      await db
        .delete(unitsTable)
        .where(and(eq(unitsTable.id, id), eq(unitsTable.userId, this.userId)));
    });
  }

  // ─── maintenance ──────────────────────────────────────────────────────────

  async clear(): Promise<void> {
    await this.scoped(async (db) => {
      await db.delete(profilesTable).where(eq(profilesTable.userId, this.userId));
      await db.delete(cardsTable).where(eq(cardsTable.userId, this.userId));
      await db.delete(contentTable);
      await db.delete(errorEventsTable).where(eq(errorEventsTable.userId, this.userId));
      await db.delete(weaknessTable).where(eq(weaknessTable.userId, this.userId));
      await db.delete(gamificationTable).where(eq(gamificationTable.userId, this.userId));
      await db.delete(questStateTable).where(eq(questStateTable.userId, this.userId));
      await db.delete(collectibleGrantsTable).where(eq(collectibleGrantsTable.userId, this.userId));
      await db.delete(lexiconCacheTable);
      await db.delete(mediaAssetsTable);
      await db.delete(unitsTable).where(eq(unitsTable.userId, this.userId));
    });
  }

  // ─── backup ───────────────────────────────────────────────────────────────

  async exportBackup(): Promise<BackupData> {
    return this.scoped(async (db) => {
      const profileRows = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, this.userId));

      const cardRows = await db.select().from(cardsTable).where(eq(cardsTable.userId, this.userId));

      const contentRows = await db.select().from(contentTable);

      const errorEventRows = await db
        .select()
        .from(errorEventsTable)
        .where(eq(errorEventsTable.userId, this.userId));

      const weaknessRows = await db
        .select()
        .from(weaknessTable)
        .where(eq(weaknessTable.userId, this.userId));

      const gamificationRows = await db
        .select()
        .from(gamificationTable)
        .where(eq(gamificationTable.userId, this.userId));

      const lexiconRows = await db.select().from(lexiconCacheTable);

      const unitRows = await db.select().from(unitsTable).where(eq(unitsTable.userId, this.userId));

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
    });
  }

  async importBackup(data: BackupData): Promise<void> {
    await this.scoped(async (db) => {
      await db.delete(profilesTable).where(eq(profilesTable.userId, this.userId));
      await db.delete(cardsTable).where(eq(cardsTable.userId, this.userId));
      await db.delete(errorEventsTable).where(eq(errorEventsTable.userId, this.userId));
      await db.delete(weaknessTable).where(eq(weaknessTable.userId, this.userId));
      await db.delete(gamificationTable).where(eq(gamificationTable.userId, this.userId));
      await db.delete(unitsTable).where(eq(unitsTable.userId, this.userId));

      for (const row of data.tables.profile) {
        await db.insert(profilesTable).values({
          userId: this.userId,
          cefrLevel: row.cefrLevel,
          goals: JSON.stringify(row.goals),
          createdAt: row.createdAt,
          settings: JSON.stringify(row.settings),
          experienceMode: row.experienceMode,
        });
      }

      for (const card of data.tables.cards) {
        await db.insert(cardsTable).values({
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
        });
      }

      for (const c of data.tables.content) {
        await db
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
          });
      }

      for (const ev of data.tables.errorEvents) {
        await db.insert(errorEventsTable).values({
          userId: this.userId,
          skill: ev.skill,
          category: ev.category,
          cefr: ev.cefr,
          context: ev.context,
          createdAt: ev.createdAt,
        });
      }

      for (const w of data.tables.weakness) {
        await db.insert(weaknessTable).values({
          userId: this.userId,
          skill: w.skill,
          category: w.category,
          cefr: w.cefr,
          score: w.score,
          confidence: w.confidence,
          updatedAt: w.updatedAt,
        });
      }

      for (const g of data.tables.gamification) {
        await db.insert(gamificationTable).values({
          userId: this.userId,
          xp: g.xp,
          level: g.level,
          streakCount: g.streakCount,
          lastActivityDate: g.lastActivityDate,
          achievements: JSON.stringify(g.achievements),
        });
      }

      for (const lex of data.tables.lexiconCache) {
        await db
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
          });
      }

      // Old-format backups (pre-#57) have no `units` key — default to empty.
      for (const u of data.tables.units ?? []) {
        await db.insert(unitsTable).values({
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
        });
      }
    });
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  private async syncMacFieldsToAppConfig(
    db: PostgresDrizzleScope,
    settings: ProfileSettings,
  ): Promise<void> {
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

    const existingRows = await db
      .select()
      .from(appConfig)
      .where(eq(appConfig.id, APP_CONFIG_ID))
      .limit(1);
    const existing = existingRows[0];

    if (existing) {
      const cloudMode = env.LANGTUTOR_MODE === "cloud";
      await db
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
        .where(eq(appConfig.id, APP_CONFIG_ID));
    } else {
      const cloudMode = env.LANGTUTOR_MODE === "cloud";
      await db.insert(appConfig).values({
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
      });
    }
  }
}
