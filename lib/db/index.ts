/**
 * Public surface of the DB layer for feature code: the data-model types and the
 * `ContentRepository` **interface**. Obtain an instance via `getContentRepository()`
 * in `lib/registry.ts` — do not import the Dexie concrete or construct `LangTutorDB`
 * outside the composition root (seam discipline, PLAN §2.3).
 */
export type {
  Achievement,
  ActivityKind,
  Card,
  Cefr,
  ChapterGate,
  ChapterGateStatus,
  ChapterReviewAssignment,
  ChapterReviewAssignmentItem,
  ChapterTier,
  Collection,
  CollectionKind,
  CollectionSummary,
  CollectibleGrant,
  Content,
  ContentSource,
  ContentType,
  ErrorEventRecord,
  ExperienceMode,
  FsrsState,
  GamificationState,
  LearnerGoal,
  LexiconCacheEntry,
  MediaAsset,
  MediaAssetApprovalStatus,
  MediaAssetKey,
  MediaAssetKind,
  MediaAssetRecord,
  MediaAssetSource,
  Profile,
  ProfileSettings,
  ProgressionMode,
  QuestProgressEntry,
  QuestState,
  Skill,
  Unit,
  UnitActivityRef,
  UnitBufferStatus,
  UnitStatus,
  Weakness,
} from "./schema";
export { DEFAULT_EXPERIENCE_MODE, DEFAULT_PROGRESSION_MODE } from "./schema";

export type { BackupData } from "../backup/schema";

export type {
  ContentQuery,
  ContentRepository,
  ContentSink,
  ErrorEventQuery,
  MediaAssetQuery,
  NewCard,
  NewCollection,
  NewContent,
  NewErrorEvent,
  NewUnit,
} from "./content-repository";
