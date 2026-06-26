import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/resolve-current-user", () => ({ resolveCurrentUser: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ getServerContentRepository: vi.fn() }));
vi.mock("@/lib/llm/runtime-config", () => ({ setRuntimeOverride: vi.fn() }));
vi.mock("@/lib/transcriber/runtime-config", () => ({ setRuntimeSttUrl: vi.fn() }));

import { redirect } from "next/navigation";

import { resolveCurrentUser } from "@/lib/auth/resolve-current-user";
import { getServerContentRepository } from "@/lib/db/server";
import { setRuntimeOverride } from "@/lib/llm/runtime-config";
import { setRuntimeSttUrl } from "@/lib/transcriber/runtime-config";
import { saveAdminConfig, saveUserPrefs } from "@/app/settings/actions";
import type { ProfileSettings } from "@/lib/db/schema";

const ADMIN = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "admin@example.com",
  role: "admin" as const,
};
const STANDARD = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "user@example.com",
  role: "standard" as const,
};

const EXISTING_SETTINGS = {
  macLlmBaseUrl: "http://mac.local:11434/v1",
  macLlmModel: "qwen2.5:14b",
  macSttUrl: "http://mac.local:8080",
  ttsRate: 1.2,
};

function makeRedirectThrow() {
  vi.mocked(redirect).mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
}

function makeMockRepo(settings: ProfileSettings = EXISTING_SETTINGS) {
  return {
    getSettings: vi.fn().mockResolvedValue(settings),
    saveSettings: vi.fn().mockResolvedValue(undefined),
  };
}

describe("saveAdminConfig", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("saves mac fields and pushes runtime overrides for admin", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(ADMIN);
    const mockRepo = makeMockRepo({});
    vi.mocked(getServerContentRepository).mockResolvedValue(mockRepo as never);

    await saveAdminConfig({
      macLlmBaseUrl: "http://new.local/v1",
      macSttUrl: "http://new.local:8080",
    });

    expect(mockRepo.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        macLlmBaseUrl: "http://new.local/v1",
        macSttUrl: "http://new.local:8080",
      }),
    );
    expect(setRuntimeOverride).toHaveBeenCalled();
    expect(setRuntimeSttUrl).toHaveBeenCalledWith("http://new.local:8080");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("merges new config over existing settings", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(ADMIN);
    const mockRepo = makeMockRepo(EXISTING_SETTINGS);
    vi.mocked(getServerContentRepository).mockResolvedValue(mockRepo as never);

    await saveAdminConfig({ macLlmBaseUrl: "http://override.local/v1" });

    const saved = mockRepo.saveSettings.mock.calls[0][0] as Record<string, unknown>;
    expect(saved.macLlmBaseUrl).toBe("http://override.local/v1");
    expect(saved.ttsRate).toBe(1.2);
  });

  it("rejects a standard user", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(STANDARD);
    makeRedirectThrow();

    await expect(saveAdminConfig({})).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("rejects an unauthenticated caller", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(null);
    makeRedirectThrow();

    await expect(saveAdminConfig({})).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});

describe("saveUserPrefs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("saves TTS prefs for a standard user and strips mac fields", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(STANDARD);
    const mockRepo = makeMockRepo(EXISTING_SETTINGS);
    vi.mocked(getServerContentRepository).mockResolvedValue(mockRepo as never);

    await saveUserPrefs({ ttsRate: 1.5 });

    const saved = mockRepo.saveSettings.mock.calls[0][0] as Record<string, unknown>;
    expect(saved.ttsRate).toBe(1.5);
    expect(saved.macLlmBaseUrl).toBeUndefined();
    expect(saved.macLlmModel).toBeUndefined();
    expect(saved.macSttUrl).toBeUndefined();
  });

  it("preserves mac fields in profile when admin saves TTS prefs", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(ADMIN);
    const mockRepo = makeMockRepo(EXISTING_SETTINGS);
    vi.mocked(getServerContentRepository).mockResolvedValue(mockRepo as never);

    await saveUserPrefs({ ttsRate: 0.8 });

    const saved = mockRepo.saveSettings.mock.calls[0][0] as Record<string, unknown>;
    expect(saved.ttsRate).toBe(0.8);
    expect(saved.macLlmBaseUrl).toBe("http://mac.local:11434/v1");
  });

  it("rejects an unauthenticated caller", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue(null);
    makeRedirectThrow();

    await expect(saveUserPrefs({ ttsRate: 1 })).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
