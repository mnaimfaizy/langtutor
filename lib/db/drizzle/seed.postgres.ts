import "server-only";

import { eq } from "drizzle-orm";

import { DEFAULT_GROQ_CHAT_MODEL } from "@/lib/ai/groq";
import { DEFAULT_MISTRAL_EMBED_MODEL } from "@/lib/ai/mistral";
import { env } from "@/lib/config/env";

import type { PostgresDrizzleClient } from "./postgres-client";
import { appConfig } from "./schema.postgres";

const APP_CONFIG_ID = 1;

/** Inserts the global `appConfig` row from env defaults if it does not yet exist. */
export async function seedPostgresAppConfig(db: PostgresDrizzleClient): Promise<void> {
  const existing = await db
    .select()
    .from(appConfig)
    .where(eq(appConfig.id, APP_CONFIG_ID))
    .limit(1);

  if (existing.length > 0) return;

  const cloudMode = env.LANGTUTOR_MODE === "cloud";

  await db.insert(appConfig).values({
    id: APP_CONFIG_ID,
    chatProvider: cloudMode ? "groq" : "mac",
    chatModel: cloudMode ? env.GROQ_CHAT_MODEL?.trim() || DEFAULT_GROQ_CHAT_MODEL : "",
    sttProvider: cloudMode ? "groq" : "mac",
    embeddingsProvider: cloudMode ? "mistral" : "mac",
    embeddingsModel: cloudMode
      ? env.MISTRAL_EMBED_MODEL?.trim() || DEFAULT_MISTRAL_EMBED_MODEL
      : "",
    macLlmBaseUrl: env.MAC_LLM_BASE_URL,
    macLlmModel: env.MAC_LLM_MODEL,
    macUtilityModel: env.MAC_UTILITY_MODEL,
    macEmbedModel: env.MAC_EMBED_MODEL,
    macSttUrl: env.MAC_STT_URL,
    updatedAt: new Date(),
  });
}
