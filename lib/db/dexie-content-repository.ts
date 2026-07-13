import type { BackupData } from "../backup/schema";
import { SINGLETON_KEY, type LangTutorDB, type Singleton } from "./database";
import type {
  ContentQuery,
  ContentRepository,
  ErrorEventQuery,
  MediaAssetQuery,
  NewCard,
  NewCollection,
  NewContent,
  NewErrorEvent,
  NewUnit,
  SharedPathUnitTemplateQuery,
} from "./content-repository";
import type {
  Card,
  ChapterGate,
  ChapterTier,
  CollectibleGrant,
  CollectionSummary,
  Content,
  ErrorEventRecord,
  GamificationState,
  LexiconCacheEntry,
  MediaAsset,
  MediaAssetKey,
  MediaAssetRecord,
  Profile,
  ProfileSettings,
  QuestState,
  SharedPathStage,
  SharedPathUnitTemplate,
  Unit,
  Weakness,
} from "./schema";
import { initCard } from "@/lib/srs/fsrs-wrapper";

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
    return this.db.cards
      .where("fsrs.due")
      .belowOrEqual(now)
      .filter((card) => !card.suspended)
      .toArray();
  }

  async updateCard(id: number, changes: Partial<NewCard>): Promise<void> {
    await this.db.cards.update(id, changes);
  }

  async deleteCard(id: number): Promise<void> {
    await this.db.cardCollectionMembers.where("cardId").equals(id).delete();
    await this.db.cards.delete(id);
  }

  async suspendCard(id: number): Promise<void> {
    await this.updateCard(id, { suspended: true });
  }

  async unsuspendCard(id: number): Promise<void> {
    await this.updateCard(id, { suspended: false });
  }

  async resetCardProgress(id: number, now = new Date()): Promise<void> {
    await this.updateCard(id, { fsrs: initCard(now) });
  }

  // deck collections --------------------------------------------------------
  addCollection(collection: NewCollection): Promise<number> {
    return this.db.collections.add(collection);
  }

  async renameCollection(id: number, name: string): Promise<void> {
    await this.db.collections.update(id, { name });
  }

  async deleteCollection(id: number): Promise<void> {
    await this.db.cardCollectionMembers.where("collectionId").equals(id).delete();
    await this.db.collections.delete(id);
  }

  async addCardToCollection(collectionId: number, cardId: number): Promise<void> {
    const existing = await this.db.cardCollectionMembers.get([collectionId, cardId]);
    if (existing) return;
    await this.db.cardCollectionMembers.put({ collectionId, cardId });
  }

  async removeCardFromCollection(collectionId: number, cardId: number): Promise<void> {
    await this.db.cardCollectionMembers.delete([collectionId, cardId]);
  }

  async getCollections(): Promise<CollectionSummary[]> {
    const [collections, members] = await Promise.all([
      this.db.collections.toArray(),
      this.db.cardCollectionMembers.toArray(),
    ]);
    return collections.map((collection) => ({
      ...collection,
      cardCount: members.filter((member) => member.collectionId === collection.id).length,
    }));
  }

  async getCollectionCards(collectionId: number): Promise<Card[]> {
    const memberCardIds = await this.db.cardCollectionMembers
      .where("collectionId")
      .equals(collectionId)
      .toArray();
    const cards = await Promise.all(memberCardIds.map((member) => this.getCard(member.cardId)));
    return cards.filter((card): card is Card => card !== undefined);
  }

  // content -----------------------------------------------------------------
  putContent(content: NewContent): Promise<number> {
    return this.db.content.add(content);
  }

  getContent(id: number): Promise<Content | undefined> {
    return this.db.content.get(id);
  }

  async queryContent(query: ContentQuery = {}): Promise<Content[]> {
    const { type, level, topic, source } = query;

    let results: Content[];
    if (type !== undefined && level !== undefined) {
      results = await this.db.content.where("[type+level]").equals([type, level]).toArray();
    } else if (type !== undefined) {
      results = await this.db.content.where("type").equals(type).toArray();
    } else if (level !== undefined) {
      results = await this.db.content.where("level").equals(level).toArray();
    } else {
      results = await this.db.content.toArray();
    }

    return results.filter(
      (c) =>
        (topic === undefined || c.topic === topic) && (source === undefined || c.source === source),
    );
  }

  // diagnostics -------------------------------------------------------------
  addErrorEvent(event: NewErrorEvent): Promise<number> {
    return this.db.errorEvents.add(event);
  }

  async queryErrorEvents(query: ErrorEventQuery = {}): Promise<ErrorEventRecord[]> {
    const { skill, cefr, category } = query;

    let results: ErrorEventRecord[];
    if (skill !== undefined && cefr !== undefined) {
      results = await this.db.errorEvents.where("[skill+cefr]").equals([skill, cefr]).toArray();
    } else if (skill !== undefined) {
      results = await this.db.errorEvents.where("skill").equals(skill).toArray();
    } else {
      results = await this.db.errorEvents.toArray();
    }

    return results.filter((e) => category === undefined || e.category === category);
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

  // quest state -------------------------------------------------------------
  async getQuestState(): Promise<QuestState | undefined> {
    const row = await this.db.questState.get(SINGLETON_KEY);
    if (!row) return undefined;
    const { id: _id, ...state } = row;
    return state;
  }

  async saveQuestState(state: QuestState): Promise<void> {
    await this.db.questState.put({ ...state, id: SINGLETON_KEY });
  }

  // collectible grants ------------------------------------------------------
  getCollectibles(): Promise<CollectibleGrant[]> {
    return this.db.collectibleGrants.toArray();
  }

  async grantCollectible(collectibleId: string, unitId: number, grantedAt: Date): Promise<void> {
    const existing = await this.db.collectibleGrants.get([collectibleId, unitId]);
    if (existing) return;
    await this.db.collectibleGrants.put({ collectibleId, unitId, grantedAt });
  }

  // lexicon cache -----------------------------------------------------------
  getLexiconEntry(word: string): Promise<LexiconCacheEntry | undefined> {
    return this.db.lexiconCache.get(word.toLowerCase());
  }

  async putLexiconEntry(entry: LexiconCacheEntry): Promise<void> {
    await this.db.lexiconCache.put({ ...entry, word: entry.word.toLowerCase() });
  }

  // media assets -----------------------------------------------------------
  async getMediaAsset(key: MediaAssetKey): Promise<MediaAsset | undefined> {
    const asset = await this.getMediaAssetRaw(key);
    if (!asset || asset.approvalStatus !== "approved") return undefined;
    return asset;
  }

  async getMediaAssetRaw(key: MediaAssetKey): Promise<MediaAsset | undefined> {
    const lookup = {
      ...key,
      key: key.key.toLowerCase(),
    };
    const asset = await this.db.mediaAssets.get([lookup.kind, lookup.key, lookup.style]);
    if (!asset) return undefined;
    return { ...asset, prompt: asset.prompt ?? null };
  }

  async putMediaAsset(asset: MediaAsset): Promise<void> {
    await this.db.mediaAssets.put({
      ...asset,
      key: asset.key.toLowerCase(),
      prompt: asset.source === "generated" ? (asset.prompt ?? null) : null,
    });
  }

  async queryMediaAssets(query?: MediaAssetQuery): Promise<MediaAssetRecord[]> {
    const rows = await this.db.mediaAssets.toArray();
    return rows
      .filter((row) => (query?.kind ? row.kind === query.kind : true))
      .filter((row) => (query?.approvalStatus ? row.approvalStatus === query.approvalStatus : true))
      .map(({ data: _data, ...record }) => ({
        ...record,
        prompt: record.prompt ?? null,
      }));
  }

  async deleteMediaAsset(key: MediaAssetKey): Promise<void> {
    const lookup = {
      ...key,
      key: key.key.toLowerCase(),
    };
    await this.db.mediaAssets.delete([lookup.kind, lookup.key, lookup.style]);
  }

  async approveMediaAsset(key: MediaAssetKey): Promise<void> {
    const asset = await this.getMediaAssetRaw(key);
    if (!asset) return;
    await this.putMediaAsset({ ...asset, approvalStatus: "approved" });
  }

  // learning path units -------------------------------------------------------
  addUnit(unit: NewUnit): Promise<number> {
    return this.db.units.add(unit);
  }

  async getUnits(): Promise<Unit[]> {
    return this.db.units.orderBy("index").toArray();
  }

  async updateUnit(id: number, changes: Partial<NewUnit>): Promise<void> {
    await this.db.units.update(id, changes);
  }

  async deleteUnit(id: number): Promise<void> {
    await this.db.units.delete(id);
  }

  // chapter mastery gates ---------------------------------------------------
  async getChapterGate(tier: ChapterTier): Promise<ChapterGate | undefined> {
    const gate = await this.db.chapterGates.get(tier);
    if (!gate) return undefined;
    return {
      ...gate,
      reviewAssignment: gate.reviewAssignment ?? null,
    };
  }

  async saveChapterGate(gate: ChapterGate): Promise<void> {
    await this.db.chapterGates.put({
      ...gate,
      reviewAssignment: gate.reviewAssignment ?? null,
    });
  }

  // shared path catalog -----------------------------------------------------
  async getSharedPathStages(): Promise<SharedPathStage[]> {
    return this.db.sharedPathStages.orderBy("order").toArray();
  }

  async putSharedPathStage(stage: SharedPathStage): Promise<void> {
    await this.db.sharedPathStages.put(stage);
  }

  async querySharedPathUnitTemplates(
    query?: SharedPathUnitTemplateQuery,
  ): Promise<SharedPathUnitTemplate[]> {
    let rows = await this.db.sharedPathUnitTemplates.toArray();
    if (query?.tier) rows = rows.filter((r) => r.tier === query.tier);
    if (query?.stageId) rows = rows.filter((r) => r.stageId === query.stageId);
    if (query?.approvalStatus) {
      rows = rows.filter((r) => r.approvalStatus === query.approvalStatus);
    }
    return rows.sort((a, b) => a.pathIndex - b.pathIndex);
  }

  async putSharedPathUnitTemplate(template: SharedPathUnitTemplate): Promise<void> {
    await this.db.sharedPathUnitTemplates.put({
      ...template,
      activities: template.activities.map((a) => ({ skill: a.skill })),
      targetVocab: template.targetVocab.slice(),
    });
  }

  async deleteSharedPathUnitTemplate(id: string): Promise<void> {
    await this.db.sharedPathUnitTemplates.delete(id);
  }

  // maintenance -------------------------------------------------------------
  async clear(): Promise<void> {
    await Promise.all(this.db.tables.map((table) => table.clear()));
  }

  // backup ------------------------------------------------------------------
  async exportBackup(): Promise<BackupData> {
    const [profile, cards, content, errorEvents, weakness, gamification, lexiconCache, units] =
      await Promise.all([
        this.db.profile.toArray(),
        this.db.cards.toArray(),
        this.db.content.toArray(),
        this.db.errorEvents.toArray(),
        this.db.weakness.toArray(),
        this.db.gamification.toArray(),
        this.db.lexiconCache.toArray(),
        this.db.units.toArray(),
      ]);
    return {
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      tables: {
        profile,
        cards,
        content,
        errorEvents,
        weakness,
        gamification,
        lexiconCache,
        units,
      },
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
      // Old-format backups (pre-#57) have no `units` key — default to empty.
      this.db.units.bulkPut((data.tables.units ?? []) as unknown as Omit<Unit, "id">[]),
    ]);
  }
}
