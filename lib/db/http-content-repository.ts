import type { BackupData } from "@/lib/backup/schema";
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
} from "./content-repository";
import type {
  Card,
  CollectionSummary,
  Content,
  ErrorEventRecord,
  CollectibleGrant,
  GamificationState,
  LexiconCacheEntry,
  MediaAsset,
  MediaAssetKey,
  MediaAssetRecord,
  Profile,
  ProfileSettings,
  QuestState,
  Unit,
  Weakness,
} from "./schema";
import {
  repoAddCard,
  repoAddErrorEvent,
  repoAddUnit,
  repoApproveMediaAsset,
  repoClear,
  repoDeleteCard,
  repoDeleteMediaAsset,
  repoSuspendCard,
  repoUnsuspendCard,
  repoResetCardProgress,
  repoAddCollection,
  repoRenameCollection,
  repoDeleteCollection,
  repoAddCardToCollection,
  repoRemoveCardFromCollection,
  repoGetCollections,
  repoGetCollectionCards,
  repoExportBackup,
  repoGetAllCards,
  repoGetCard,
  repoGetContent,
  repoGetDueCards,
  repoGetGamification,
  repoGetCollectibles,
  repoGetLexiconEntry,
  repoGetMediaAsset,
  repoGetMediaAssetRaw,
  repoGetProfile,
  repoGetQuestState,
  repoGetSettings,
  repoGetUnits,
  repoGetWeaknesses,
  repoGrantCollectible,
  repoImportBackup,
  repoPutContent,
  repoPutLexiconEntry,
  repoPutMediaAsset,
  repoPutWeakness,
  repoQueryContent,
  repoQueryErrorEvents,
  repoQueryMediaAssets,
  repoSaveGamification,
  repoSaveProfile,
  repoSaveQuestState,
  repoSaveSettings,
  repoUpdateCard,
  repoUpdateUnit,
  repoDeleteUnit,
} from "./content-actions";

export class HttpContentRepository implements ContentRepository {
  getProfile(): Promise<Profile | undefined> {
    return repoGetProfile();
  }
  saveProfile(profile: Profile): Promise<void> {
    return repoSaveProfile(profile);
  }
  getSettings(): Promise<ProfileSettings> {
    return repoGetSettings();
  }
  saveSettings(settings: ProfileSettings): Promise<void> {
    return repoSaveSettings(settings);
  }
  addCard(card: NewCard): Promise<number> {
    return repoAddCard(card);
  }
  getCard(id: number): Promise<Card | undefined> {
    return repoGetCard(id);
  }
  getAllCards(): Promise<Card[]> {
    return repoGetAllCards();
  }
  getDueCards(now: Date): Promise<Card[]> {
    return repoGetDueCards(now);
  }
  updateCard(id: number, changes: Partial<NewCard>): Promise<void> {
    return repoUpdateCard(id, changes);
  }
  deleteCard(id: number): Promise<void> {
    return repoDeleteCard(id);
  }
  suspendCard(id: number): Promise<void> {
    return repoSuspendCard(id);
  }
  unsuspendCard(id: number): Promise<void> {
    return repoUnsuspendCard(id);
  }
  resetCardProgress(id: number, now?: Date): Promise<void> {
    return repoResetCardProgress(id, now);
  }
  addCollection(collection: NewCollection): Promise<number> {
    return repoAddCollection(collection);
  }
  renameCollection(id: number, name: string): Promise<void> {
    return repoRenameCollection(id, name);
  }
  deleteCollection(id: number): Promise<void> {
    return repoDeleteCollection(id);
  }
  addCardToCollection(collectionId: number, cardId: number): Promise<void> {
    return repoAddCardToCollection(collectionId, cardId);
  }
  removeCardFromCollection(collectionId: number, cardId: number): Promise<void> {
    return repoRemoveCardFromCollection(collectionId, cardId);
  }
  getCollections(): Promise<CollectionSummary[]> {
    return repoGetCollections();
  }
  getCollectionCards(collectionId: number): Promise<Card[]> {
    return repoGetCollectionCards(collectionId);
  }
  putContent(content: NewContent): Promise<number> {
    return repoPutContent(content);
  }
  getContent(id: number): Promise<Content | undefined> {
    return repoGetContent(id);
  }
  queryContent(query?: ContentQuery): Promise<Content[]> {
    return repoQueryContent(query);
  }
  addErrorEvent(event: NewErrorEvent): Promise<number> {
    return repoAddErrorEvent(event);
  }
  queryErrorEvents(query?: ErrorEventQuery): Promise<ErrorEventRecord[]> {
    return repoQueryErrorEvents(query);
  }
  getWeaknesses(): Promise<Weakness[]> {
    return repoGetWeaknesses();
  }
  putWeakness(weakness: Weakness): Promise<void> {
    return repoPutWeakness(weakness);
  }
  getGamification(): Promise<GamificationState | undefined> {
    return repoGetGamification();
  }
  saveGamification(state: GamificationState): Promise<void> {
    return repoSaveGamification(state);
  }
  getQuestState(): Promise<QuestState | undefined> {
    return repoGetQuestState();
  }
  saveQuestState(state: QuestState): Promise<void> {
    return repoSaveQuestState(state);
  }
  getCollectibles(): Promise<CollectibleGrant[]> {
    return repoGetCollectibles();
  }
  grantCollectible(collectibleId: string, unitId: number, grantedAt: Date): Promise<void> {
    return repoGrantCollectible(collectibleId, unitId, grantedAt);
  }
  getLexiconEntry(word: string): Promise<LexiconCacheEntry | undefined> {
    return repoGetLexiconEntry(word);
  }
  putLexiconEntry(entry: LexiconCacheEntry): Promise<void> {
    return repoPutLexiconEntry(entry);
  }
  getMediaAsset(key: MediaAssetKey): Promise<MediaAsset | undefined> {
    return repoGetMediaAsset(key);
  }
  getMediaAssetRaw(key: MediaAssetKey): Promise<MediaAsset | undefined> {
    return repoGetMediaAssetRaw(key);
  }
  putMediaAsset(asset: MediaAsset): Promise<void> {
    return repoPutMediaAsset(asset);
  }
  queryMediaAssets(query?: MediaAssetQuery): Promise<MediaAssetRecord[]> {
    return repoQueryMediaAssets(query);
  }
  deleteMediaAsset(key: MediaAssetKey): Promise<void> {
    return repoDeleteMediaAsset(key);
  }
  approveMediaAsset(key: MediaAssetKey): Promise<void> {
    return repoApproveMediaAsset(key);
  }
  addUnit(unit: NewUnit): Promise<number> {
    return repoAddUnit(unit);
  }
  getUnits(): Promise<Unit[]> {
    return repoGetUnits();
  }
  updateUnit(id: number, changes: Partial<NewUnit>): Promise<void> {
    return repoUpdateUnit(id, changes);
  }
  deleteUnit(id: number): Promise<void> {
    return repoDeleteUnit(id);
  }
  clear(): Promise<void> {
    return repoClear();
  }
  exportBackup(): Promise<BackupData> {
    return repoExportBackup();
  }
  importBackup(data: BackupData): Promise<void> {
    return repoImportBackup(data);
  }
}
