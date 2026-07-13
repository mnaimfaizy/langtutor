import Dexie, { type EntityTable, type Table } from "dexie";
import type {
  Card,
  Cefr,
  ChapterGate,
  CollectibleGrant,
  Collection,
  Content,
  ErrorEventRecord,
  GamificationState,
  LexiconCacheEntry,
  MediaAsset,
  MediaAssetKind,
  PreA1StageId,
  Profile,
  QuestState,
  SharedPathStage,
  SharedPathUnitTemplate,
  Skill,
  Unit,
  Weakness,
} from "./schema";

/** Primary key shared by single-row tables (`profile`, `gamification`, `questState`). */
export const SINGLETON_KEY = 1 as const;

/** Stored shape of a single-row table: the entity plus its fixed primary key. */
export type Singleton<T> = T & { id: typeof SINGLETON_KEY };

/** Compound primary key for the `weakness` table: (skill, category, cefr). */
export type WeaknessKey = [Skill, string, Cefr];

/** Compound primary key for the `mediaAssets` table: (kind, key, style). */
export type MediaAssetCompoundKey = [MediaAssetKind, string, string];

/** Compound primary key for the `collectibleGrants` table: (collectibleId, unitId). */
export type CollectibleGrantKey = [string, number];

/** Compound primary key for `cardCollectionMembers`: (collectionId, cardId). */
export type CardCollectionMemberKey = [number, number];

/** Stored membership row in `cardCollectionMembers`. */
export interface CardCollectionMember {
  collectionId: number;
  cardId: number;
}

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
  questState!: Table<Singleton<QuestState>, number>;
  weakness!: Table<Weakness, WeaknessKey>;
  lexiconCache!: Table<LexiconCacheEntry, string>;
  mediaAssets!: Table<MediaAsset, MediaAssetCompoundKey>;
  collectibleGrants!: Table<CollectibleGrant, CollectibleGrantKey>;
  collections!: EntityTable<Collection, "id">;
  cardCollectionMembers!: Table<CardCollectionMember, CardCollectionMemberKey>;
  /** Keyed by chapter tier (`pre-A1`, `A1`, …). */
  chapterGates!: Table<ChapterGate, string>;
  /** Shared path catalog stages (ADR 0051, issue #125) — keyed by stage id. */
  sharedPathStages!: Table<SharedPathStage, PreA1StageId>;
  /** Shared path catalog unit templates — keyed by template id. */
  sharedPathUnitTemplates!: Table<SharedPathUnitTemplate, string>;

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
    // v5: kid-safety approval gate (issue #69).
    this.version(5)
      .stores({
        mediaAssets: "[kind+key+style], approvalStatus",
      })
      .upgrade(async (tx) => {
        await tx
          .table("mediaAssets")
          .toCollection()
          .modify((asset: MediaAsset) => {
            if (!asset.source) asset.source = "generated";
            if (!asset.approvalStatus) asset.approvalStatus = "approved";
          });
      });
    // v6: quest state + collectible grants (ADR 0019, issue #76).
    this.version(6).stores({
      questState: "id",
      collectibleGrants: "[collectibleId+unitId]",
    });
    // v7: deck collections + card suspend flag (issue #90).
    this.version(7).stores({
      collections: "++id, kind",
      cardCollectionMembers: "[collectionId+cardId], collectionId, cardId",
    });
    // v8: chapter mastery-gate status (ADR 0043, issue #114).
    this.version(8).stores({
      chapterGates: "tier",
    });
    // v9: shared pre-A1 path catalog (ADR 0051, issue #125).
    this.version(9).stores({
      sharedPathStages: "id, order",
      sharedPathUnitTemplates: "id, stageId, pathIndex, approvalStatus",
    });
  }
}
