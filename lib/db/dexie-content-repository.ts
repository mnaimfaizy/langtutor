import type { BackupData } from "../backup/schema";
import { SINGLETON_KEY, type LangTutorDB, type Singleton } from "./database";
import type {
  ContentQuery,
  ContentRepository,
  ErrorEventQuery,
  NewCard,
  NewContent,
  NewErrorEvent,
} from "./content-repository";
import type {
  Card,
  Content,
  ErrorEventRecord,
  GamificationState,
  LexiconCacheEntry,
  Profile,
  ProfileSettings,
  Weakness,
} from "./schema";

/**
 * Dexie-backed {@link ContentRepository}. Constructed once in `lib/registry.ts`; feature
 * code never imports this class directly (seam discipline — PLAN §2.3).
 *
 * `profile` and `gamification` are single-row tables: their primary key is hidden behind
 * {@link SINGLETON_KEY} so callers deal in plain entities, not storage keys.
 */
export class DexieContentRepository implements ContentRepository {
  constructor(private readonly db: LangTutorDB) {}

  // profile -----------------------------------------------------------------
  async getProfile(): Promise<Profile | undefined> {
    const row = await this.db.profile.get(SINGLETON_KEY);
    if (!row) return undefined;
    const { id: _id, ...profile } = row;
    return profile;
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.db.profile.put({ ...profile, id: SINGLETON_KEY });
  }

  async getSettings(): Promise<ProfileSettings> {
    return (await this.getProfile())?.settings ?? {};
  }

  async saveSettings(settings: ProfileSettings): Promise<void> {
    // Works before onboarding: create a settings-only profile (no cefrLevel yet) if none exists.
    const existing = await this.getProfile();
    const profile: Profile = existing
      ? { ...existing, settings }
      : { goals: [], createdAt: new Date(), settings };
    await this.saveProfile(profile);
  }

  // cards -------------------------------------------------------------------
  addCard(card: NewCard): Promise<number> {
    return this.db.cards.add(card);
  }

  getCard(id: number): Promise<Card | undefined> {
    return this.db.cards.get(id);
  }

  getAllCards(): Promise<Card[]> {
    return this.db.cards.toArray();
  }

  getDueCards(now: Date): Promise<Card[]> {
    return this.db.cards.where("fsrs.due").belowOrEqual(now).toArray();
  }

  async updateCard(id: number, changes: Partial<NewCard>): Promise<void> {
    await this.db.cards.update(id, changes);
  }

  async deleteCard(id: number): Promise<void> {
    await this.db.cards.delete(id);
  }

  // content -----------------------------------------------------------------
  putContent(content: NewContent): Promise<number> {
    return this.db.content.add(content);
  }

  getContent(id: number): Promise<Content | undefined> {
    return this.db.content.get(id);
  }

  // Single-user scale → an in-memory filter over the small content set is fine and keeps
  // multi-field queries simple. The declared indexes (type/level/topic/source) remain
  // available for later optimization.
  async queryContent(query: ContentQuery = {}): Promise<Content[]> {
    const all = await this.db.content.toArray();
    return all.filter(
      (c) =>
        (query.type === undefined || c.type === query.type) &&
        (query.level === undefined || c.level === query.level) &&
        (query.topic === undefined || c.topic === query.topic) &&
        (query.source === undefined || c.source === query.source),
    );
  }

  // diagnostics -------------------------------------------------------------
  addErrorEvent(event: NewErrorEvent): Promise<number> {
    return this.db.errorEvents.add(event);
  }

  async queryErrorEvents(query: ErrorEventQuery = {}): Promise<ErrorEventRecord[]> {
    const all = await this.db.errorEvents.toArray();
    return all.filter(
      (e) =>
        (query.skill === undefined || e.skill === query.skill) &&
        (query.category === undefined || e.category === query.category) &&
        (query.cefr === undefined || e.cefr === query.cefr),
    );
  }

  // weakness ----------------------------------------------------------------
  getWeaknesses(): Promise<Weakness[]> {
    return this.db.weakness.toArray();
  }

  async putWeakness(weakness: Weakness): Promise<void> {
    await this.db.weakness.put(weakness);
  }

  // gamification ------------------------------------------------------------
  async getGamification(): Promise<GamificationState | undefined> {
    const row = await this.db.gamification.get(SINGLETON_KEY);
    if (!row) return undefined;
    const { id: _id, ...state } = row;
    return state;
  }

  async saveGamification(state: GamificationState): Promise<void> {
    await this.db.gamification.put({ ...state, id: SINGLETON_KEY });
  }

  // lexicon cache -----------------------------------------------------------
  getLexiconEntry(word: string): Promise<LexiconCacheEntry | undefined> {
    return this.db.lexiconCache.get(word.toLowerCase());
  }

  async putLexiconEntry(entry: LexiconCacheEntry): Promise<void> {
    await this.db.lexiconCache.put({ ...entry, word: entry.word.toLowerCase() });
  }

  // maintenance -------------------------------------------------------------
  async clear(): Promise<void> {
    await Promise.all(this.db.tables.map((table) => table.clear()));
  }

  // backup ------------------------------------------------------------------
  async exportBackup(): Promise<BackupData> {
    const [profile, cards, content, errorEvents, weakness, gamification, lexiconCache] =
      await Promise.all([
        this.db.profile.toArray(),
        this.db.cards.toArray(),
        this.db.content.toArray(),
        this.db.errorEvents.toArray(),
        this.db.weakness.toArray(),
        this.db.gamification.toArray(),
        this.db.lexiconCache.toArray(),
      ]);
    return {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      tables: { profile, cards, content, errorEvents, weakness, gamification, lexiconCache },
    } as BackupData;
  }

  async importBackup(data: BackupData): Promise<void> {
    await this.clear();
    // All tables use inbound keys (the key lives IN the object: `id` for EntityTables,
    // compound key fields for weakness, `word` for lexiconCache). Pass full objects so
    // Dexie finds the existing key and restores original IDs. The `as unknown as X[]`
    // casts are needed because EntityTable's TypeScript type has TInsertType = Omit<T,"id">,
    // but at runtime Dexie reads the inbound `id` field when it is present.
    await Promise.all([
      this.db.profile.bulkPut(data.tables.profile as unknown as Singleton<Profile>[]),
      this.db.cards.bulkPut(data.tables.cards as unknown as Omit<Card, "id">[]),
      this.db.content.bulkPut(data.tables.content as unknown as Omit<Content, "id">[]),
      this.db.errorEvents.bulkPut(
        data.tables.errorEvents as unknown as Omit<ErrorEventRecord, "id">[],
      ),
      this.db.weakness.bulkPut(data.tables.weakness as unknown as Weakness[]),
      this.db.gamification.bulkPut(
        data.tables.gamification as unknown as Singleton<GamificationState>[],
      ),
      this.db.lexiconCache.bulkPut(data.tables.lexiconCache as unknown as LexiconCacheEntry[]),
    ]);
  }
}
