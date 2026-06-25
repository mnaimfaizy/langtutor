import type {
  BackupData,
  Card,
  Content,
  ErrorEventRecord,
  GamificationState,
  LexiconCacheEntry,
  NewCard,
  NewContent,
  NewErrorEvent,
  Profile,
  ProfileSettings,
  Weakness,
} from "@/lib/db";
import type { ContentQuery, ContentRepository, ErrorEventQuery } from "@/lib/db";
import type { ContentValidator, ValidationResult } from "@/lib/content/content-validator";

// Server-side no-op repository. The pipeline requires a ContentRepository to cache results,
// but on the server there is no Dexie (browser-only). The client caches the result in
// IndexedDB after receiving the response — only putContent() is ever called by the pipeline.
export class NullContentRepository implements ContentRepository {
  putContent(_c: NewContent): Promise<number> {
    return Promise.resolve(0);
  }
  getContent(_id: number): Promise<Content | undefined> {
    return Promise.resolve(undefined);
  }
  queryContent(_q?: ContentQuery): Promise<Content[]> {
    return Promise.resolve([]);
  }
  getProfile(): Promise<Profile | undefined> {
    return Promise.resolve(undefined);
  }
  saveProfile(_p: Profile): Promise<void> {
    return Promise.resolve();
  }
  getSettings(): Promise<ProfileSettings> {
    return Promise.resolve({});
  }
  saveSettings(_s: ProfileSettings): Promise<void> {
    return Promise.resolve();
  }
  addCard(_c: NewCard): Promise<number> {
    return Promise.resolve(0);
  }
  getCard(_id: number): Promise<Card | undefined> {
    return Promise.resolve(undefined);
  }
  getAllCards(): Promise<Card[]> {
    return Promise.resolve([]);
  }
  getDueCards(_now: Date): Promise<Card[]> {
    return Promise.resolve([]);
  }
  updateCard(_id: number, _changes: Partial<NewCard>): Promise<void> {
    return Promise.resolve();
  }
  deleteCard(_id: number): Promise<void> {
    return Promise.resolve();
  }
  addErrorEvent(_e: NewErrorEvent): Promise<number> {
    return Promise.resolve(0);
  }
  queryErrorEvents(_q?: ErrorEventQuery): Promise<ErrorEventRecord[]> {
    return Promise.resolve([]);
  }
  getWeaknesses(): Promise<Weakness[]> {
    return Promise.resolve([]);
  }
  putWeakness(_w: Weakness): Promise<void> {
    return Promise.resolve();
  }
  getGamification(): Promise<GamificationState | undefined> {
    return Promise.resolve(undefined);
  }
  saveGamification(_s: GamificationState): Promise<void> {
    return Promise.resolve();
  }
  getLexiconEntry(_word: string): Promise<LexiconCacheEntry | undefined> {
    return Promise.resolve(undefined);
  }
  putLexiconEntry(_e: LexiconCacheEntry): Promise<void> {
    return Promise.resolve();
  }
  clear(): Promise<void> {
    return Promise.resolve();
  }
  exportBackup(): Promise<BackupData> {
    return Promise.reject(new Error("not supported on server"));
  }
  importBackup(_data: BackupData): Promise<void> {
    return Promise.reject(new Error("not supported on server"));
  }
}

// Bypasses CEFR word/grammar gating — used for teacher-voice content (e.g. writing prompts)
// where lexical/grammatical constraints do not apply.
export class NullContentValidator implements ContentValidator {
  validate(): ValidationResult {
    return { ok: true, violations: [] };
  }
}
