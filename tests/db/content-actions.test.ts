import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BackupData,
  GamificationState,
  LexiconCacheEntry,
  MediaAsset,
  MediaAssetKey,
  NewCard,
  NewContent,
  NewErrorEvent,
  NewUnit,
  Profile,
  Weakness,
} from "@/lib/db";

// Allow importing lib/db/server.ts (which has `import "server-only"`) in Vitest's Node env.
vi.mock("server-only", () => ({}));

// vi.mock calls are hoisted; use vi.hoisted() to share variables with their factories.
const mockRepo = vi.hoisted(() => ({
  getProfile: vi.fn().mockResolvedValue(undefined),
  saveProfile: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({}),
  saveSettings: vi.fn().mockResolvedValue(undefined),
  addCard: vi.fn().mockResolvedValue(1),
  getCard: vi.fn().mockResolvedValue(undefined),
  getAllCards: vi.fn().mockResolvedValue([]),
  getDueCards: vi.fn().mockResolvedValue([]),
  updateCard: vi.fn().mockResolvedValue(undefined),
  deleteCard: vi.fn().mockResolvedValue(undefined),
  putContent: vi.fn().mockResolvedValue(1),
  getContent: vi.fn().mockResolvedValue(undefined),
  queryContent: vi.fn().mockResolvedValue([]),
  addErrorEvent: vi.fn().mockResolvedValue(1),
  queryErrorEvents: vi.fn().mockResolvedValue([]),
  getWeaknesses: vi.fn().mockResolvedValue([]),
  putWeakness: vi.fn().mockResolvedValue(undefined),
  getGamification: vi.fn().mockResolvedValue(undefined),
  saveGamification: vi.fn().mockResolvedValue(undefined),
  getLexiconEntry: vi.fn().mockResolvedValue(undefined),
  putLexiconEntry: vi.fn().mockResolvedValue(undefined),
  getMediaAsset: vi.fn().mockResolvedValue(undefined),
  getMediaAssetRaw: vi.fn().mockResolvedValue(undefined),
  putMediaAsset: vi.fn().mockResolvedValue(undefined),
  queryMediaAssets: vi.fn().mockResolvedValue([]),
  deleteMediaAsset: vi.fn().mockResolvedValue(undefined),
  approveMediaAsset: vi.fn().mockResolvedValue(undefined),
  addUnit: vi.fn().mockResolvedValue(1),
  getUnits: vi.fn().mockResolvedValue([]),
  updateUnit: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  exportBackup: vi.fn().mockResolvedValue({}),
  importBackup: vi.fn().mockResolvedValue(undefined),
}));

const mockResolveCurrentUser = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ id: "bootstrap-admin", email: "admin@example.com", role: "admin" }),
);

vi.mock("@/lib/db/drizzle/client", () => ({
  getDrizzleClient: vi.fn().mockReturnValue({}),
}));

vi.mock("@/lib/db/sqlite-content-repository", () => ({
  // Regular function (not arrow) so `new SqliteContentRepository()` works as a constructor.
  // Returning an object from a constructor causes JS to use that object as the result.
  SqliteContentRepository: vi.fn(function () {
    return mockRepo;
  }),
}));

vi.mock("@/lib/auth/resolve-current-user", () => ({
  resolveCurrentUser: mockResolveCurrentUser,
}));

import * as actions from "@/lib/db/content-actions";

describe("content actions — identity routing", () => {
  beforeEach(() => {
    mockResolveCurrentUser.mockClear();
  });

  it("every action calls resolveCurrentUser exactly once", async () => {
    await actions.repoGetProfile();
    await actions.repoSaveProfile({} as Profile);
    await actions.repoGetSettings();
    await actions.repoSaveSettings({});
    await actions.repoAddCard({} as NewCard);
    await actions.repoGetCard(1);
    await actions.repoGetAllCards();
    await actions.repoGetDueCards(new Date());
    await actions.repoUpdateCard(1, {});
    await actions.repoDeleteCard(1);
    await actions.repoPutContent({} as NewContent);
    await actions.repoGetContent(1);
    await actions.repoQueryContent();
    await actions.repoAddErrorEvent({} as NewErrorEvent);
    await actions.repoQueryErrorEvents();
    await actions.repoGetWeaknesses();
    await actions.repoPutWeakness({} as Weakness);
    await actions.repoGetGamification();
    await actions.repoSaveGamification({} as GamificationState);
    await actions.repoGetLexiconEntry("hello");
    await actions.repoPutLexiconEntry({} as LexiconCacheEntry);
    await actions.repoGetMediaAsset({} as MediaAssetKey);
    await actions.repoGetMediaAssetRaw({} as MediaAssetKey);
    await actions.repoPutMediaAsset({} as MediaAsset);
    await actions.repoQueryMediaAssets();
    await actions.repoDeleteMediaAsset({} as MediaAssetKey);
    await actions.repoApproveMediaAsset({} as MediaAssetKey);
    await actions.repoAddUnit({} as NewUnit);
    await actions.repoGetUnits();
    await actions.repoUpdateUnit(1, {});
    await actions.repoClear();
    await actions.repoExportBackup();
    await actions.repoImportBackup({} as BackupData);

    expect(mockResolveCurrentUser).toHaveBeenCalledTimes(33);
  });
});
