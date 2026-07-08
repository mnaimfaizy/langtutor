import type { BackupData } from "../backup/schema";
import type {
  Card,
  Cefr,
  Content,
  ContentSource,
  ContentType,
  ErrorEventRecord,
  GamificationState,
  LexiconCacheEntry,
  MediaAsset,
  MediaAssetApprovalStatus,
  MediaAssetKey,
  MediaAssetKind,
  MediaAssetRecord,
  Profile,
  ProfileSettings,
  Skill,
  Unit,
  Weakness,
} from "./schema";

/** Insert shapes for auto-keyed entities — the numeric `id` is assigned by the store. */
export type NewCard = Omit<Card, "id">;
export type NewContent = Omit<Content, "id">;
export type NewErrorEvent = Omit<ErrorEventRecord, "id">;
export type NewUnit = Omit<Unit, "id">;

/** Optional filters for {@link ContentRepository.queryContent}. */
export interface ContentQuery {
  type?: ContentType;
  level?: Cefr;
  topic?: string;
  source?: ContentSource;
}

/** Optional filters for {@link ContentRepository.queryErrorEvents}. */
export interface ErrorEventQuery {
  skill?: Skill;
  category?: string;
  cefr?: Cefr;
}

/** Optional filters for {@link ContentRepository.queryMediaAssets} (admin review). */
export interface MediaAssetQuery {
  kind?: MediaAssetKind;
  approvalStatus?: MediaAssetApprovalStatus;
}

/**
 * Narrow write-only seam consumed by the content generation pipeline. The pipeline
 * only ever persists generated content — it never reads back or touches cards, profile,
 * or gamification. Accepting this interface instead of the full `ContentRepository`
 * keeps the pipeline's dependency honest and lets server routes pass a 3-line no-op
 * instead of a 30-method stub.
 */
export interface ContentSink {
  putContent(content: NewContent): Promise<number>;
}

/**
 * Persistence seam (PLAN §2.3). Feature code imports **this interface**, never a
 * concrete provider; the Dexie implementation is wired in `lib/registry.ts`. Swapping
 * to a future `SyncedRepository` (cloud) is then a registry change, not a call-site one.
 */
export interface ContentRepository extends ContentSink {
  // profile (single row)
  getProfile(): Promise<Profile | undefined>;
  saveProfile(profile: Profile): Promise<void>;

  // settings (the `settings` slice of the profile; usable before onboarding)
  getSettings(): Promise<ProfileSettings>;
  saveSettings(settings: ProfileSettings): Promise<void>;

  // cards (vocab SRS)
  addCard(card: NewCard): Promise<number>;
  getCard(id: number): Promise<Card | undefined>;
  getAllCards(): Promise<Card[]>;
  /** Cards whose next review is due at or before `now`, ascending by due date (`fsrs.due` index). */
  getDueCards(now: Date): Promise<Card[]>;
  updateCard(id: number, changes: Partial<NewCard>): Promise<void>;
  deleteCard(id: number): Promise<void>;

  // content (cached generated/seed)
  putContent(content: NewContent): Promise<number>;
  getContent(id: number): Promise<Content | undefined>;
  queryContent(query?: ContentQuery): Promise<Content[]>;

  // diagnostics
  addErrorEvent(event: NewErrorEvent): Promise<number>;
  queryErrorEvents(query?: ErrorEventQuery): Promise<ErrorEventRecord[]>;

  // weakness (derived rollup; keyed by skill+category+cefr)
  getWeaknesses(): Promise<Weakness[]>;
  putWeakness(weakness: Weakness): Promise<void>;

  // gamification (single row)
  getGamification(): Promise<GamificationState | undefined>;
  saveGamification(state: GamificationState): Promise<void>;

  // lexicon cache (case-insensitive on `word`)
  getLexiconEntry(word: string): Promise<LexiconCacheEntry | undefined>;
  putLexiconEntry(entry: LexiconCacheEntry): Promise<void>;

  // media assets (ADR 0016 — shared, keyed by kind+word/phrase+style)
  /** Learner-facing lookup — returns only {@link MediaAssetApprovalStatus} `approved` assets. */
  getMediaAsset(key: MediaAssetKey): Promise<MediaAsset | undefined>;
  /** Admin/internal lookup — returns any approval state. */
  getMediaAssetRaw(key: MediaAssetKey): Promise<MediaAsset | undefined>;
  putMediaAsset(asset: MediaAsset): Promise<void>;
  /** Admin listing — metadata only (no binary payload). */
  queryMediaAssets(query?: MediaAssetQuery): Promise<MediaAssetRecord[]>;
  deleteMediaAsset(key: MediaAssetKey): Promise<void>;
  approveMediaAsset(key: MediaAssetKey): Promise<void>;

  // learning path units (ADR 0015, issue #57)
  addUnit(unit: NewUnit): Promise<number>;
  /** All units for the current user, ordered by `index` ascending. */
  getUnits(): Promise<Unit[]>;
  updateUnit(id: number, changes: Partial<NewUnit>): Promise<void>;
  deleteUnit(id: number): Promise<void>;

  /** Wipe every table. Used by import/restore (Phase 8.2) and tests. */
  clear(): Promise<void>;

  // backup (Phase 8.2)
  exportBackup(): Promise<BackupData>;
  importBackup(data: BackupData): Promise<void>;
}
