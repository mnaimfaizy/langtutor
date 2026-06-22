import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  Card,
  Cefr,
  Content,
  ErrorEventRecord,
  GamificationState,
  LexiconCacheEntry,
  Profile,
  Skill,
  Weakness,
} from "./schema";

/** Primary key shared by single-row tables (`profile`, `gamification`). */
export const SINGLETON_KEY = 1 as const;

/** Stored shape of a single-row table: the entity plus its fixed primary key. */
export type Singleton<T> = T & { id: typeof SINGLETON_KEY };

/** Compound primary key for the `weakness` table: (skill, category, cefr). */
export type WeaknessKey = [Skill, string, Cefr];

/**
 * The IndexedDB database for Lang-Tutor — one store per PLAN §4 table.
 *
 * Schema is **versioned**: bump `version(n).stores({...})` and add `.upgrade(tx => …)`
 * for a migration when a store's keys/indexes change. Never edit a shipped version in
 * place — add the next one (Dexie replays versions in order on open).
 *
 * This class is the only place that touches Dexie directly besides the repository impl.
 */
export class LangTutorDB extends Dexie {
  // Auto-incremented numeric ids; insert type omits `id` (EntityTable).
  cards!: EntityTable<Card, "id">;
  content!: EntityTable<Content, "id">;
  errorEvents!: EntityTable<ErrorEventRecord, "id">;

  // Inbound (caller-provided) keys.
  profile!: Table<Singleton<Profile>, number>;
  gamification!: Table<Singleton<GamificationState>, number>;
  weakness!: Table<Weakness, WeaknessKey>;
  lexiconCache!: Table<LexiconCacheEntry, string>;

  constructor(name = "lang-tutor") {
    super(name);
    this.version(1).stores({
      profile: "id",
      cards: "++id, word, fsrs.due, cefr",
      content: "++id, type, level, topic, source",
      errorEvents: "++id, skill, category, cefr, createdAt",
      weakness: "[skill+category+cefr], skill, cefr",
      gamification: "id",
      lexiconCache: "word",
    });
  }
}
