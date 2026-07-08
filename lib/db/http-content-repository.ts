import type { BackupData } from "@/lib/backup/schema";
import type {
  ContentQuery,
  ContentRepository,
  ErrorEventQuery,
  NewCard,
  NewContent,
  NewErrorEvent,
  NewUnit,
} from "./content-repository";
import type {
  Card,
  Content,
  ErrorEventRecord,
  GamificationState,
  LexiconCacheEntry,
  MediaAsset,
  MediaAssetKey,
  Profile,
  ProfileSettings,
  Unit,
  Weakness,
} from "./schema";
import {
  repoAddCard,
  repoAddErrorEvent,
  repoAddUnit,
  repoClear,
  repoDeleteCard,
  repoExportBackup,
  repoGetAllCards,
  repoGetCard,
  repoGetContent,
  repoGetDueCards,
  repoGetGamification,
  repoGetLexiconEntry,
  repoGetMediaAsset,
  repoGetProfile,
  repoGetSettings,
  repoGetUnits,
  repoGetWeaknesses,
  repoImportBackup,
  repoPutContent,
  repoPutLexiconEntry,
  repoPutMediaAsset,
  repoPutWeakness,
  repoQueryContent,
  repoQueryErrorEvents,
  repoSaveGamification,
  repoSaveProfile,
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
  getLexiconEntry(word: string): Promise<LexiconCacheEntry | undefined> {
    return repoGetLexiconEntry(word);
  }
  putLexiconEntry(entry: LexiconCacheEntry): Promise<void> {
    return repoPutLexiconEntry(entry);
  }
  getMediaAsset(key: MediaAssetKey): Promise<MediaAsset | undefined> {
    return repoGetMediaAsset(key);
  }
  putMediaAsset(asset: MediaAsset): Promise<void> {
    return repoPutMediaAsset(asset);
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
