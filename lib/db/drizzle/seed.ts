import "server-only";

import { eq } from "drizzle-orm";

import { env } from "@/lib/config/env";

import type { DrizzleClient } from "./client";
import { appConfig } from "./schema";

const APP_CONFIG_ID = 1;

/**
 * Inserts the `appConfig` row from env defaults if it does not yet exist.
 * Preserves the "env default → runtime override" pattern, now stored globally.
 */
export function seedAppConfig(db: DrizzleClient): void {
  const existing = db.select().from(appConfig).where(eq(appConfig.id, APP_CONFIG_ID)).get();
  if (existing) return;

  db.insert(appConfig)
    .values({
      id: APP_CONFIG_ID,
      macLlmBaseUrl: env.MAC_LLM_BASE_URL,
      macLlmModel: env.MAC_LLM_MODEL,
      macUtilityModel: env.MAC_UTILITY_MODEL,
      macEmbedModel: env.MAC_EMBED_MODEL,
      macSttUrl: env.MAC_STT_URL,
      updatedAt: new Date(),
    })
    .run();
}
