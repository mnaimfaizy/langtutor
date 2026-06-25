"use server";

import type { BackupData } from "@/lib/backup/schema";
import type {
  ContentQuery,
  ErrorEventQuery,
  NewCard,
  NewContent,
  NewErrorEvent,
} from "@/lib/db/content-repository";
import type {
  Card,
  Content,
  ErrorEventRecord,
  GamificationState,
  LexiconCacheEntry,
  Profile,
  ProfileSettings,
  Weakness,
} from "@/lib/db/schema";

import { getServerContentRepository } from "./server";

export async function repoGetProfile(): Promise<Profile | undefined> {
  return getServerContentRepository().getProfile();
}

export async function repoSaveProfile(profile: Profile): Promise<void> {
  return getServerContentRepository().saveProfile(profile);
}

export async function repoGetSettings(): Promise<ProfileSettings> {
  return getServerContentRepository().getSettings();
}

export async function repoSaveSettings(settings: ProfileSettings): Promise<void> {
  return getServerContentRepository().saveSettings(settings);
}

export async function repoAddCard(card: NewCard): Promise<number> {
  return getServerContentRepository().addCard(card);
}

export async function repoGetCard(id: number): Promise<Card | undefined> {
  return getServerContentRepository().getCard(id);
}

export async function repoGetAllCards(): Promise<Card[]> {
  return getServerContentRepository().getAllCards();
}

export async function repoGetDueCards(now: Date): Promise<Card[]> {
  return getServerContentRepository().getDueCards(now);
}

export async function repoUpdateCard(id: number, changes: Partial<NewCard>): Promise<void> {
  return getServerContentRepository().updateCard(id, changes);
}

export async function repoDeleteCard(id: number): Promise<void> {
  return getServerContentRepository().deleteCard(id);
}

export async function repoPutContent(content: NewContent): Promise<number> {
  return getServerContentRepository().putContent(content);
}

export async function repoGetContent(id: number): Promise<Content | undefined> {
  return getServerContentRepository().getContent(id);
}

export async function repoQueryContent(query?: ContentQuery): Promise<Content[]> {
  return getServerContentRepository().queryContent(query);
}

export async function repoAddErrorEvent(event: NewErrorEvent): Promise<number> {
  return getServerContentRepository().addErrorEvent(event);
}

export async function repoQueryErrorEvents(query?: ErrorEventQuery): Promise<ErrorEventRecord[]> {
  return getServerContentRepository().queryErrorEvents(query);
}

export async function repoGetWeaknesses(): Promise<Weakness[]> {
  return getServerContentRepository().getWeaknesses();
}

export async function repoPutWeakness(weakness: Weakness): Promise<void> {
  return getServerContentRepository().putWeakness(weakness);
}

export async function repoGetGamification(): Promise<GamificationState | undefined> {
  return getServerContentRepository().getGamification();
}

export async function repoSaveGamification(state: GamificationState): Promise<void> {
  return getServerContentRepository().saveGamification(state);
}

export async function repoGetLexiconEntry(word: string): Promise<LexiconCacheEntry | undefined> {
  return getServerContentRepository().getLexiconEntry(word);
}

export async function repoPutLexiconEntry(entry: LexiconCacheEntry): Promise<void> {
  return getServerContentRepository().putLexiconEntry(entry);
}

export async function repoClear(): Promise<void> {
  return getServerContentRepository().clear();
}

export async function repoExportBackup(): Promise<BackupData> {
  return getServerContentRepository().exportBackup();
}

export async function repoImportBackup(data: BackupData): Promise<void> {
  return getServerContentRepository().importBackup(data);
}
