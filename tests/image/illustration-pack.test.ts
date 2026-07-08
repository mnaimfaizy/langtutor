import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ILLUSTRATION_PACK_STYLE,
  illustrationPackEntryCount,
  seedIllustrationPackIfEmpty,
} from "@/lib/content/illustration-pack-data";
import { resolveWordImage } from "@/lib/image/resolve-word-image";
import { MockImageGenerator } from "@/lib/image/mock-image-generator";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

beforeEach(() => {
  db = new LangTutorDB(`illustration-pack-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
});

describe("seedIllustrationPackIfEmpty", () => {
  it("seeds every curated-pack entry as approved learner-visible assets", async () => {
    await seedIllustrationPackIfEmpty(repo);

    const rows = await repo.queryMediaAssets({ kind: "image", approvalStatus: "approved" });
    expect(rows).toHaveLength(illustrationPackEntryCount());
    expect(rows.every((row) => row.source === "curated-pack")).toBe(true);
    expect(rows.every((row) => row.style === ILLUSTRATION_PACK_STYLE)).toBe(true);
  });

  it("is idempotent on repeat calls", async () => {
    await seedIllustrationPackIfEmpty(repo);
    await seedIllustrationPackIfEmpty(repo);

    const rows = await repo.queryMediaAssets({ kind: "image" });
    expect(rows).toHaveLength(illustrationPackEntryCount());
  });
});

describe("resolveWordImage — pack-first sourcing", () => {
  beforeEach(async () => {
    await seedIllustrationPackIfEmpty(repo);
  });

  it("never calls the generator for a word present in the curated pack", async () => {
    const generator = new MockImageGenerator({ data: new Uint8Array([99]) });

    const first = await resolveWordImage(repo, generator, "apple");
    const second = await resolveWordImage(repo, generator, "Apple");

    expect(generator.calls).toHaveLength(0);
    expect(first?.source).toBe("curated-pack");
    expect(second?.data).toEqual(first?.data);
    expect(first?.approvalStatus).toBe("approved");
  });

  it("falls back to the generator once for pack misses, then serves from the store", async () => {
    const generator = new MockImageGenerator({ data: new Uint8Array([42]) });

    const first = await resolveWordImage(repo, generator, "xylophone");
    const second = await resolveWordImage(repo, generator, "xylophone");

    expect(generator.calls).toHaveLength(1);
    expect(first).toBeUndefined();
    expect(second).toBeUndefined();

    const stored = await repo.getMediaAssetRaw({
      kind: "image",
      key: "xylophone",
      style: ILLUSTRATION_PACK_STYLE,
    });
    expect(stored?.source).toBe("generated");
    expect(stored?.approvalStatus).toBe("pending");
    expect(stored?.data).toEqual(new Uint8Array([42]));
  });
});
