"use server";

import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { getServerContentRepository } from "@/lib/db/server";
import type { ProfileSettings } from "@/lib/db/schema";
import { setRuntimeOverride } from "@/lib/llm/runtime-config";
import { settingsToOverrides } from "@/lib/llm/settings";
import { setRuntimeSttUrl } from "@/lib/transcriber/runtime-config";

type MacConfig = Pick<
  ProfileSettings,
  "macLlmBaseUrl" | "macLlmModel" | "macUtilityModel" | "macEmbedModel" | "macSttUrl"
>;

type TtsPrefs = Pick<ProfileSettings, "ttsRate" | "ttsVoiceUri" | "ttsLang">;

const MAC_KEYS: Array<keyof MacConfig> = [
  "macLlmBaseUrl",
  "macLlmModel",
  "macUtilityModel",
  "macEmbedModel",
  "macSttUrl",
];

function stripMacFields(settings: ProfileSettings): ProfileSettings {
  const stripped = { ...settings };
  for (const key of MAC_KEYS) delete stripped[key];
  return stripped;
}

/** Returns the current user's role so the settings UI can gate admin-only fields. */
export async function getSettingsRole(): Promise<"admin" | "standard"> {
  const user = await requireUser();
  return user.role;
}

/**
 * Admin-only: persist Mac/LLM/STT infra config to the user profile and the shared
 * appConfig table, then push runtime overrides so the current process uses the updated
 * endpoints immediately without requiring a server restart.
 */
export async function saveAdminConfig(config: MacConfig): Promise<void> {
  await requireAdmin();
  const repo = await getServerContentRepository();
  const current = await repo.getSettings();
  const merged: ProfileSettings = { ...current, ...config };
  await repo.saveSettings(merged);
  setRuntimeOverride(settingsToOverrides(merged));
  setRuntimeSttUrl(merged.macSttUrl);
}

/**
 * Any authenticated user: persist TTS preferences to the user's profile. Mac/infra
 * fields are stripped from the current settings before saving so standard users cannot
 * overwrite global appConfig.
 */
export async function saveUserPrefs(prefs: Partial<TtsPrefs>): Promise<void> {
  const user = await requireUser();
  const repo = await getServerContentRepository();
  const current = await repo.getSettings();
  const base = user.role === "admin" ? current : stripMacFields(current);
  await repo.saveSettings({ ...base, ...prefs });
}
