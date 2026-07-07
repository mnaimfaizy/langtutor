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
  Content,
  ContentSource,
  ContentType,
  ErrorEventRecord,
  ExperienceMode,
  FsrsState,
  GamificationState,
  LearnerGoal,
  LexiconCacheEntry,
  Profile,
  ProfileSettings,
  Skill,
  Unit,
  UnitActivityRef,
  UnitBufferStatus,
  UnitStatus,
  Weakness,
} from "./schema";
export { DEFAULT_EXPERIENCE_MODE } from "./schema";

export type { BackupData } from "../backup/schema";

export type {
  ContentQuery,
  ContentRepository,
  ContentSink,
  ErrorEventQuery,
  NewCard,
  NewContent,
  NewErrorEvent,
  NewUnit,
} from "./content-repository";
