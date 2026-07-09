"use server";

import type { BackupData } from "@/lib/backup/schema";
import type {
  ContentQuery,
  ErrorEventQuery,
  MediaAssetQuery,
  NewCard,
  NewCollection,
  NewContent,
  NewErrorEvent,
  NewUnit,
} from "@/lib/db/content-repository";
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
} from "@/lib/db/schema";
import { reanchorOnProfileChange } from "@/lib/path/reanchor";

import { getServerContentRepository } from "./server";

export async function repoGetProfile(): Promise<Profile | undefined> {
  return (await getServerContentRepository()).getProfile();
}

/**
 * Saves the profile, then re-anchors the path's future units if this save changed the
 * learner's CEFR level (issue #63) — the single server-side choke point every profile save
 * passes through, whether from the onboarding placement quiz or a Settings edit. Reuses one
 * repository instance for the whole operation so this still counts as a single
 * `resolveCurrentUser` call, same as every other action here.
 */
export async function repoSaveProfile(profile: Profile): Promise<void> {
  const repo = await getServerContentRepository();
  const previous = await repo.getProfile();
  await repo.saveProfile(profile);
  await reanchorOnProfileChange(repo, previous, profile);
}

export async function repoGetSettings(): Promise<ProfileSettings> {
  return (await getServerContentRepository()).getSettings();
}

export async function repoSaveSettings(settings: ProfileSettings): Promise<void> {
  return (await getServerContentRepository()).saveSettings(settings);
}

export async function repoAddCard(card: NewCard): Promise<number> {
  return (await getServerContentRepository()).addCard(card);
}

export async function repoGetCard(id: number): Promise<Card | undefined> {
  return (await getServerContentRepository()).getCard(id);
}

export async function repoGetAllCards(): Promise<Card[]> {
  return (await getServerContentRepository()).getAllCards();
}

export async function repoGetDueCards(now: Date): Promise<Card[]> {
  return (await getServerContentRepository()).getDueCards(now);
}

export async function repoUpdateCard(id: number, changes: Partial<NewCard>): Promise<void> {
  return (await getServerContentRepository()).updateCard(id, changes);
}

export async function repoDeleteCard(id: number): Promise<void> {
  return (await getServerContentRepository()).deleteCard(id);
}

export async function repoSuspendCard(id: number): Promise<void> {
  return (await getServerContentRepository()).suspendCard(id);
}

export async function repoUnsuspendCard(id: number): Promise<void> {
  return (await getServerContentRepository()).unsuspendCard(id);
}

export async function repoResetCardProgress(id: number, now?: Date): Promise<void> {
  return (await getServerContentRepository()).resetCardProgress(id, now);
}

export async function repoAddCollection(collection: NewCollection): Promise<number> {
  return (await getServerContentRepository()).addCollection(collection);
}

export async function repoRenameCollection(id: number, name: string): Promise<void> {
  return (await getServerContentRepository()).renameCollection(id, name);
}

export async function repoDeleteCollection(id: number): Promise<void> {
  return (await getServerContentRepository()).deleteCollection(id);
}

export async function repoAddCardToCollection(collectionId: number, cardId: number): Promise<void> {
  return (await getServerContentRepository()).addCardToCollection(collectionId, cardId);
}

export async function repoRemoveCardFromCollection(
  collectionId: number,
  cardId: number,
): Promise<void> {
  return (await getServerContentRepository()).removeCardFromCollection(collectionId, cardId);
}

export async function repoGetCollections(): Promise<CollectionSummary[]> {
  return (await getServerContentRepository()).getCollections();
}

export async function repoGetCollectionCards(collectionId: number): Promise<Card[]> {
  return (await getServerContentRepository()).getCollectionCards(collectionId);
}

export async function repoPutContent(content: NewContent): Promise<number> {
  return (await getServerContentRepository()).putContent(content);
}

export async function repoGetContent(id: number): Promise<Content | undefined> {
  return (await getServerContentRepository()).getContent(id);
}

export async function repoQueryContent(query?: ContentQuery): Promise<Content[]> {
  return (await getServerContentRepository()).queryContent(query);
}

export async function repoAddErrorEvent(event: NewErrorEvent): Promise<number> {
  return (await getServerContentRepository()).addErrorEvent(event);
}

export async function repoQueryErrorEvents(query?: ErrorEventQuery): Promise<ErrorEventRecord[]> {
  return (await getServerContentRepository()).queryErrorEvents(query);
}

export async function repoGetWeaknesses(): Promise<Weakness[]> {
  return (await getServerContentRepository()).getWeaknesses();
}

export async function repoPutWeakness(weakness: Weakness): Promise<void> {
  return (await getServerContentRepository()).putWeakness(weakness);
}

export async function repoGetGamification(): Promise<GamificationState | undefined> {
  return (await getServerContentRepository()).getGamification();
}

export async function repoSaveGamification(state: GamificationState): Promise<void> {
  return (await getServerContentRepository()).saveGamification(state);
}

export async function repoGetQuestState(): Promise<QuestState | undefined> {
  return (await getServerContentRepository()).getQuestState();
}

export async function repoSaveQuestState(state: QuestState): Promise<void> {
  return (await getServerContentRepository()).saveQuestState(state);
}

export async function repoGetCollectibles(): Promise<CollectibleGrant[]> {
  return (await getServerContentRepository()).getCollectibles();
}

export async function repoGrantCollectible(
  collectibleId: string,
  unitId: number,
  grantedAt: Date,
): Promise<void> {
  return (await getServerContentRepository()).grantCollectible(collectibleId, unitId, grantedAt);
}

export async function repoGetLexiconEntry(word: string): Promise<LexiconCacheEntry | undefined> {
  return (await getServerContentRepository()).getLexiconEntry(word);
}

export async function repoPutLexiconEntry(entry: LexiconCacheEntry): Promise<void> {
  return (await getServerContentRepository()).putLexiconEntry(entry);
}

export async function repoGetMediaAsset(key: MediaAssetKey): Promise<MediaAsset | undefined> {
  return (await getServerContentRepository()).getMediaAsset(key);
}

export async function repoGetMediaAssetRaw(key: MediaAssetKey): Promise<MediaAsset | undefined> {
  return (await getServerContentRepository()).getMediaAssetRaw(key);
}

export async function repoPutMediaAsset(asset: MediaAsset): Promise<void> {
  return (await getServerContentRepository()).putMediaAsset(asset);
}

export async function repoQueryMediaAssets(query?: MediaAssetQuery): Promise<MediaAssetRecord[]> {
  return (await getServerContentRepository()).queryMediaAssets(query);
}

export async function repoDeleteMediaAsset(key: MediaAssetKey): Promise<void> {
  return (await getServerContentRepository()).deleteMediaAsset(key);
}

export async function repoApproveMediaAsset(key: MediaAssetKey): Promise<void> {
  return (await getServerContentRepository()).approveMediaAsset(key);
}

export async function repoAddUnit(unit: NewUnit): Promise<number> {
  return (await getServerContentRepository()).addUnit(unit);
}

export async function repoGetUnits(): Promise<Unit[]> {
  return (await getServerContentRepository()).getUnits();
}

export async function repoUpdateUnit(id: number, changes: Partial<NewUnit>): Promise<void> {
  return (await getServerContentRepository()).updateUnit(id, changes);
}

export async function repoDeleteUnit(id: number): Promise<void> {
  return (await getServerContentRepository()).deleteUnit(id);
}

export async function repoClear(): Promise<void> {
  return (await getServerContentRepository()).clear();
}

export async function repoExportBackup(): Promise<BackupData> {
  return (await getServerContentRepository()).exportBackup();
}

export async function repoImportBackup(data: BackupData): Promise<void> {
  return (await getServerContentRepository()).importBackup(data);
}
