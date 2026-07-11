import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BOOTSTRAP_ADMIN_ID,
  appConfig,
  cards,
  content,
  errorEvents,
  gamification,
  lexiconCache,
  mediaAssets,
  collectibleGrants,
  questState,
  chapterGates,
  profiles,
  weakness,
} from "@/lib/db/drizzle/schema";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle/migrations");

function openInMemory() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { sqlite, db };
}

describe("Drizzle schema constants", () => {
  it("BOOTSTRAP_ADMIN_ID is a non-empty string", () => {
    expect(typeof BOOTSTRAP_ADMIN_ID).toBe("string");
    expect(BOOTSTRAP_ADMIN_ID.length).toBeGreaterThan(0);
  });
});

describe("Migration — table existence", () => {
  let sqlite: ReturnType<typeof Database>;

  beforeEach(() => {
    ({ sqlite } = openInMemory());
  });

  afterEach(() => {
    sqlite.close();
  });

  function tableNames(): string[] {
    return (
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
  }

  it("creates all expected tables including media_assets and quest tables", () => {
    const names = tableNames();
    expect(names).toContain("app_config");
    expect(names).toContain("cards");
    expect(names).toContain("collectible_grants");
    expect(names).toContain("content");
    expect(names).toContain("error_events");
    expect(names).toContain("gamification");
    expect(names).toContain("lexicon_cache");
    expect(names).toContain("media_assets");
    expect(names).toContain("profile");
    expect(names).toContain("quest_state");
    expect(names).toContain("chapter_gates");
    expect(names).toContain("weakness");
  });
});

describe("Migration — indexes", () => {
  let sqlite: ReturnType<typeof Database>;

  beforeEach(() => {
    ({ sqlite } = openInMemory());
  });

  afterEach(() => {
    sqlite.close();
  });

  function indexesOn(table: string): string[] {
    return (
      sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=?")
        .all(table) as { name: string }[]
    ).map((r) => r.name);
  }

  it("creates cards due index", () => {
    expect(indexesOn("cards")).toContain("idx_cards_user_due");
  });

  it("creates content type+level index", () => {
    expect(indexesOn("content")).toContain("idx_content_type_level");
  });

  it("creates error_events skill+cefr index", () => {
    expect(indexesOn("error_events")).toContain("idx_error_events_skill_cefr");
  });

  it("creates profile user_id unique index", () => {
    expect(indexesOn("profile")).toContain("idx_profile_user_id");
  });

  it("creates gamification user_id unique index", () => {
    expect(indexesOn("gamification")).toContain("idx_gamification_user_id");
  });

  it("creates quest_state user_id unique index", () => {
    expect(indexesOn("quest_state")).toContain("idx_quest_state_user_id");
  });
});

describe("Migration — schema shape", () => {
  let sqlite: ReturnType<typeof Database>;

  beforeEach(() => {
    ({ sqlite } = openInMemory());
  });

  afterEach(() => {
    sqlite.close();
  });

  function columns(table: string): string[] {
    return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
      (r) => r.name,
    );
  }

  it("app_config has provider routing columns", () => {
    expect(columns("app_config")).toContain("chat_provider");
    expect(columns("app_config")).toContain("chat_model");
    expect(columns("app_config")).toContain("stt_provider");
    expect(columns("app_config")).toContain("embeddings_provider");
    expect(columns("app_config")).toContain("embeddings_model");
    expect(columns("app_config")).toContain("mac_llm_base_url");
    expect(columns("app_config")).toContain("mac_llm_model");
  });

  it("content has no user_id (shared table)", () => {
    expect(columns("content")).not.toContain("user_id");
    expect(columns("content")).toContain("type");
    expect(columns("content")).toContain("level");
  });

  it("lexicon_cache has no user_id (shared table)", () => {
    expect(columns("lexicon_cache")).not.toContain("user_id");
    expect(columns("lexicon_cache")).toContain("word");
  });

  it("media_assets has no user_id (shared table)", () => {
    expect(columns("media_assets")).not.toContain("user_id");
    expect(columns("media_assets")).toContain("kind");
    expect(columns("media_assets")).toContain("key");
    expect(columns("media_assets")).toContain("style");
    expect(columns("media_assets")).toContain("data");
    expect(columns("media_assets")).toContain("source");
    expect(columns("media_assets")).toContain("approval_status");
    expect(columns("media_assets")).toContain("prompt");
  });

  it("profile has user_id (per-user table)", () => {
    expect(columns("profile")).toContain("user_id");
  });

  it("profile has experience_mode (ADR 0014)", () => {
    expect(columns("profile")).toContain("experience_mode");
  });

  it("cards has user_id and due_at (per-user, denormalized due)", () => {
    expect(columns("cards")).toContain("user_id");
    expect(columns("cards")).toContain("due_at");
    expect(columns("cards")).toContain("fsrs");
  });

  it("error_events has user_id (per-user table)", () => {
    expect(columns("error_events")).toContain("user_id");
    expect(columns("error_events")).toContain("skill");
    expect(columns("error_events")).toContain("cefr");
  });

  it("weakness has user_id as part of compound PK", () => {
    expect(columns("weakness")).toContain("user_id");
    expect(columns("weakness")).toContain("skill");
    expect(columns("weakness")).toContain("category");
    expect(columns("weakness")).toContain("cefr");
  });

  it("gamification has user_id (per-user table)", () => {
    expect(columns("gamification")).toContain("user_id");
    expect(columns("gamification")).toContain("xp");
    expect(columns("gamification")).toContain("streak_count");
  });

  it("quest_state has user_id (per-user singleton)", () => {
    expect(columns("quest_state")).toContain("user_id");
    expect(columns("quest_state")).toContain("daily_period_start");
    expect(columns("quest_state")).toContain("entries");
  });

  it("chapter_gates has user_id+tier compound PK columns", () => {
    expect(columns("chapter_gates")).toContain("user_id");
    expect(columns("chapter_gates")).toContain("tier");
    expect(columns("chapter_gates")).toContain("status");
    expect(columns("chapter_gates")).toContain("updated_at");
  });

  it("collectible_grants has user_id as part of compound PK", () => {
    expect(columns("collectible_grants")).toContain("user_id");
    expect(columns("collectible_grants")).toContain("collectible_id");
    expect(columns("collectible_grants")).toContain("unit_id");
    expect(columns("collectible_grants")).toContain("granted_at");
  });
});

describe("Drizzle schema table objects", () => {
  it("exports all expected table objects", () => {
    expect(appConfig).toBeDefined();
    expect(cards).toBeDefined();
    expect(content).toBeDefined();
    expect(errorEvents).toBeDefined();
    expect(gamification).toBeDefined();
    expect(questState).toBeDefined();
    expect(chapterGates).toBeDefined();
    expect(collectibleGrants).toBeDefined();
    expect(lexiconCache).toBeDefined();
    expect(mediaAssets).toBeDefined();
    expect(profiles).toBeDefined();
    expect(weakness).toBeDefined();
  });
});
