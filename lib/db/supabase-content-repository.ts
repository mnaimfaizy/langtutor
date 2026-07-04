import "server-only";

import { and, asc, eq, lte } from "drizzle-orm";

import type { BackupData } from "../backup/schema";
import type {
  ContentQuery,
  ContentRepository,
  ErrorEventQuery,
  NewCard,
  NewContent,
  NewErrorEvent,
} from "./content-repository";
import type { PostgresDrizzleClient } from "./drizzle/postgres-client";
import {
  BOOTSTRAP_ADMIN_ID,
  appConfig,
  cards as cardsTable,
  content as contentTable,
  errorEvents as errorEventsTable,
  gamification as gamificationTable,
  lexiconCache as lexiconCacheTable,
  profiles as profilesTable,
  weakness as weaknessTable,
} from "./drizzle/schema.postgres";
import type {
  Achievement,
  Card,
  Content,
  ErrorEventRecord,
  FsrsState,
  GamificationState,
  LexiconCacheEntry,
  Profile,
  ProfileSettings,
  Weakness,
} from "./schema";

const APP_CONFIG_ID = 1;

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

// ─── Repository ────────────────────────────────────────────────────────────────

/**
 * Drizzle/Postgres implementation of {@link ContentRepository}. Server-side only —
 * constructed exclusively in a server composition root (`lib/db/server.ts`).
 *
 * Every per-user read/write is scoped by `userId` via Drizzle `.where()` clauses
 * (app-enforced scoping; ADR 0003).
 */
export class SupabaseContentRepository implements ContentRepository {
  constructor(
    private readonly db: PostgresDrizzleClient,
    private readonly userId: string = BOOTSTRAP_ADMIN_ID,
  ) {}

  // ─── profile ─────────────────────────────────────────────────────────────

  async getProfile(): Promise<Profile | undefined> {
    const rows = await this.db
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
    };
  }

  async saveProfile(profile: Profile): Promise<void> {
    const settingsJson = JSON.stringify(profile.settings);
    const goalsJson = JSON.stringify(profile.goals);

    const existing = await this.db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.userId, this.userId))
      .limit(1);

    if (existing[0]) {
      await this.db
        .update(profilesTable)
        .set({
          cefrLevel: profile.cefrLevel,
          goals: goalsJson,
          createdAt: profile.createdAt,
          settings: settingsJson,
        })
        .where(eq(profilesTable.userId, this.userId));
    } else {
      await this.db.insert(profilesTable).values({
        userId: this.userId,
        cefrLevel: profile.cefrLevel,
        goals: goalsJson,
        createdAt: profile.createdAt,
        settings: settingsJson,
      });
    }

    await this.syncMacFieldsToAppConfig(profile.settings);
  }

  // ─── settings ─────────────────────────────────────────────────────────────

  async getSettings(): Promise<ProfileSettings> {
    const profileRows = await this.db
      .select({ settings: profilesTable.settings })
      .from(profilesTable)
      .where(eq(profilesTable.userId, this.userId))
      .limit(1);

    const profileRow = profileRows[0];
    if (profileRow) {
      return JSON.parse(profileRow.settings) as ProfileSettings;
    }

    const configRows = await this.db
      .select()
      .from(appConfig)
      .where(eq(appConfig.id, APP_CONFIG_ID))
      .limit(1);

    const configRow = configRows[0];
    if (!configRow) return {};

    const settings: ProfileSettings = {};
    if (configRow.macLlmBaseUrl) settings.macLlmBaseUrl = configRow.macLlmBaseUrl;
    if (configRow.macLlmModel) settings.macLlmModel = configRow.macLlmModel;
    if (configRow.macUtilityModel) settings.macUtilityModel = configRow.macUtilityModel;
    if (configRow.macEmbedModel) settings.macEmbedModel = configRow.macEmbedModel;
    if (configRow.macSttUrl) settings.macSttUrl = configRow.macSttUrl;
    return settings;
  }

  async saveSettings(settings: ProfileSettings): Promise<void> {
    const settingsJson = JSON.stringify(settings);

    const existing = await this.db
      .select({ id: profilesTable.id })
      .from(profilesTable)
      .where(eq(profilesTable.userId, this.userId))
      .limit(1);

    if (existing[0]) {
      await this.db
        .update(profilesTable)
        .set({ settings: settingsJson })
        .where(eq(profilesTable.userId, this.userId));
    } else {
      await this.db.insert(profilesTable).values({
        userId: this.userId,
        goals: "[]",
        createdAt: new Date(),
        settings: settingsJson,
      });
    }

    await this.syncMacFieldsToAppConfig(settings);
  }

  // ─── cards ────────────────────────────────────────────────────────────────

  async addCard(card: NewCard): Promise<number> {
    const inserted = await this.db
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
  }

  async getCard(id: number): Promise<Card | undefined> {
    const rows = await this.db
      .select()
      .from(cardsTable)
      .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, this.userId)))
      .limit(1);
    const row = rows[0];
    return row ? rowToCard(row) : undefined;
  }

  async getAllCards(): Promise<Card[]> {
    const rows = await this.db.select().from(cardsTable).where(eq(cardsTable.userId, this.userId));
    return rows.map(rowToCard);
  }

  async getDueCards(now: Date): Promise<Card[]> {
    const rows = await this.db
      .select()
      .from(cardsTable)
      .where(and(eq(cardsTable.userId, this.userId), lte(cardsTable.dueAt, now)))
      .orderBy(asc(cardsTable.dueAt));
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

    await this.db
      .update(cardsTable)
      .set(patch)
      .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, this.userId)));
  }

  async deleteCard(id: number): Promise<void> {
    await this.db
      .delete(cardsTable)
      .where(and(eq(cardsTable.id, id), eq(cardsTable.userId, this.userId)));
  }

  // ─── content ──────────────────────────────────────────────────────────────

  async putContent(content: NewContent): Promise<number> {
    const inserted = await this.db
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
  }

  async getContent(id: number): Promise<Content | undefined> {
    const rows = await this.db.select().from(contentTable).where(eq(contentTable.id, id)).limit(1);
    const row = rows[0];
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
        ? await this.db
            .select()
            .from(contentTable)
            .where(and(...conditions))
        : await this.db.select().from(contentTable);

    return rows.map(rowToContent);
  }

  // ─── diagnostics ──────────────────────────────────────────────────────────

  async addErrorEvent(event: NewErrorEvent): Promise<number> {
    const inserted = await this.db
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
  }

  async queryErrorEvents(query: ErrorEventQuery = {}): Promise<ErrorEventRecord[]> {
    const { skill, cefr, category } = query;
    const conditions = [eq(errorEventsTable.userId, this.userId)];
    if (skill !== undefined) conditions.push(eq(errorEventsTable.skill, skill));
    if (cefr !== undefined) conditions.push(eq(errorEventsTable.cefr, cefr));
    if (category !== undefined) conditions.push(eq(errorEventsTable.category, category));

    const rows = await this.db
      .select()
      .from(errorEventsTable)
      .where(and(...conditions));
    return rows.map(rowToErrorEvent);
  }

  // ─── weakness ─────────────────────────────────────────────────────────────

  async getWeaknesses(): Promise<Weakness[]> {
    const rows = await this.db
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
  }

  async putWeakness(weakness: Weakness): Promise<void> {
    await this.db
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
  }

  // ─── gamification ─────────────────────────────────────────────────────────

  async getGamification(): Promise<GamificationState | undefined> {
    const rows = await this.db
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
  }

  async saveGamification(state: GamificationState): Promise<void> {
    const achievementsJson = JSON.stringify(state.achievements);

    const existing = await this.db
      .select({ id: gamificationTable.id })
      .from(gamificationTable)
      .where(eq(gamificationTable.userId, this.userId))
      .limit(1);

    if (existing[0]) {
      await this.db
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
      await this.db.insert(gamificationTable).values({
        userId: this.userId,
        xp: state.xp,
        level: state.level,
        streakCount: state.streakCount,
        lastActivityDate: state.lastActivityDate,
        achievements: achievementsJson,
      });
    }
  }

  // ─── lexicon cache ────────────────────────────────────────────────────────

  async getLexiconEntry(word: string): Promise<LexiconCacheEntry | undefined> {
    const rows = await this.db
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
  }

  async putLexiconEntry(entry: LexiconCacheEntry): Promise<void> {
    await this.db
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
  }

  // ─── maintenance ──────────────────────────────────────────────────────────

  async clear(): Promise<void> {
    await this.db.delete(profilesTable).where(eq(profilesTable.userId, this.userId));
    await this.db.delete(cardsTable).where(eq(cardsTable.userId, this.userId));
    await this.db.delete(contentTable);
    await this.db.delete(errorEventsTable).where(eq(errorEventsTable.userId, this.userId));
    await this.db.delete(weaknessTable).where(eq(weaknessTable.userId, this.userId));
    await this.db.delete(gamificationTable).where(eq(gamificationTable.userId, this.userId));
    await this.db.delete(lexiconCacheTable);
  }

  // ─── backup ───────────────────────────────────────────────────────────────

  async exportBackup(): Promise<BackupData> {
    const profileRows = await this.db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, this.userId));

    const cardRows = await this.db
      .select()
      .from(cardsTable)
      .where(eq(cardsTable.userId, this.userId));

    const contentRows = await this.db.select().from(contentTable);

    const errorEventRows = await this.db
      .select()
      .from(errorEventsTable)
      .where(eq(errorEventsTable.userId, this.userId));

    const weaknessRows = await this.db
      .select()
      .from(weaknessTable)
      .where(eq(weaknessTable.userId, this.userId));

    const gamificationRows = await this.db
      .select()
      .from(gamificationTable)
      .where(eq(gamificationTable.userId, this.userId));

    const lexiconRows = await this.db.select().from(lexiconCacheTable);

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
      },
    };
  }

  async importBackup(data: BackupData): Promise<void> {
    await this.db.delete(profilesTable).where(eq(profilesTable.userId, this.userId));
    await this.db.delete(cardsTable).where(eq(cardsTable.userId, this.userId));
    await this.db.delete(errorEventsTable).where(eq(errorEventsTable.userId, this.userId));
    await this.db.delete(weaknessTable).where(eq(weaknessTable.userId, this.userId));
    await this.db.delete(gamificationTable).where(eq(gamificationTable.userId, this.userId));

    for (const row of data.tables.profile) {
      await this.db.insert(profilesTable).values({
        userId: this.userId,
        cefrLevel: row.cefrLevel,
        goals: JSON.stringify(row.goals),
        createdAt: row.createdAt,
        settings: JSON.stringify(row.settings),
      });
    }

    for (const card of data.tables.cards) {
      await this.db.insert(cardsTable).values({
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
      await this.db
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
      await this.db.insert(errorEventsTable).values({
        userId: this.userId,
        skill: ev.skill,
        category: ev.category,
        cefr: ev.cefr,
        context: ev.context,
        createdAt: ev.createdAt,
      });
    }

    for (const w of data.tables.weakness) {
      await this.db.insert(weaknessTable).values({
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
      await this.db.insert(gamificationTable).values({
        userId: this.userId,
        xp: g.xp,
        level: g.level,
        streakCount: g.streakCount,
        lastActivityDate: g.lastActivityDate,
        achievements: JSON.stringify(g.achievements),
      });
    }

    for (const lex of data.tables.lexiconCache) {
      await this.db
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
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  private async syncMacFieldsToAppConfig(settings: ProfileSettings): Promise<void> {
    const hasMacFields =
      settings.macLlmBaseUrl !== undefined ||
      settings.macLlmModel !== undefined ||
      settings.macUtilityModel !== undefined ||
      settings.macEmbedModel !== undefined ||
      settings.macSttUrl !== undefined;

    if (!hasMacFields) return;

    const existingRows = await this.db
      .select()
      .from(appConfig)
      .where(eq(appConfig.id, APP_CONFIG_ID))
      .limit(1);
    const existing = existingRows[0];

    if (existing) {
      await this.db
        .update(appConfig)
        .set({
          macLlmBaseUrl: settings.macLlmBaseUrl ?? existing.macLlmBaseUrl,
          macLlmModel: settings.macLlmModel ?? existing.macLlmModel,
          macUtilityModel: settings.macUtilityModel ?? existing.macUtilityModel,
          macEmbedModel: settings.macEmbedModel ?? existing.macEmbedModel,
          macSttUrl: settings.macSttUrl ?? existing.macSttUrl,
          updatedAt: new Date(),
        })
        .where(eq(appConfig.id, APP_CONFIG_ID));
    } else {
      await this.db.insert(appConfig).values({
        id: APP_CONFIG_ID,
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
