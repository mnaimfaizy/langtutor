import "server-only";

import { eq } from "drizzle-orm";

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

  await db.insert(appConfig).values({
    id: APP_CONFIG_ID,
    macLlmBaseUrl: env.MAC_LLM_BASE_URL,
    macLlmModel: env.MAC_LLM_MODEL,
    macUtilityModel: env.MAC_UTILITY_MODEL,
    macEmbedModel: env.MAC_EMBED_MODEL,
    macSttUrl: env.MAC_STT_URL,
    updatedAt: new Date(),
  });
}
