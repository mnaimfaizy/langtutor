import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  Card,
  Cefr,
  Content,
  ErrorEventRecord,
  GamificationState,
  LexiconCacheEntry,
  MediaAsset,
  MediaAssetKind,
  Profile,
  Skill,
  Unit,
  Weakness,
} from "./schema";

/** Primary key shared by single-row tables (`profile`, `gamification`). */
export const SINGLETON_KEY = 1 as const;

/** Stored shape of a single-row table: the entity plus its fixed primary key. */
export type Singleton<T> = T & { id: typeof SINGLETON_KEY };

/** Compound primary key for the `weakness` table: (skill, category, cefr). */
export type WeaknessKey = [Skill, string, Cefr];

/** Compound primary key for the `mediaAssets` table: (kind, key, style). */
export type MediaAssetCompoundKey = [MediaAssetKind, string, string];

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
  units!: EntityTable<Unit, "id">;

  // Inbound (caller-provided) keys.
  profile!: Table<Singleton<Profile>, number>;
  gamification!: Table<Singleton<GamificationState>, number>;
  weakness!: Table<Weakness, WeaknessKey>;
  lexiconCache!: Table<LexiconCacheEntry, string>;
  mediaAssets!: Table<MediaAsset, MediaAssetCompoundKey>;

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
    // v2: compound indexes for the two most-queried multi-field filter patterns.
    this.version(2).stores({
      content: "++id, type, level, [type+level], topic, source",
      errorEvents: "++id, skill, category, cefr, [skill+cefr], createdAt",
    });
    // v3: learning path units (ADR 0015, issue #57). Old (pre-multi-user) Dexie
    // installs never had a path; this store starts empty and is only exercised by
    // the migration-round-trip test harness, not real user data.
    this.version(3).stores({
      units: "++id, index, status",
    });
    // v4: shared media asset store (ADR 0016, issue #65).
    this.version(4).stores({
      mediaAssets: "[kind+key+style]",
    });
  }
}
