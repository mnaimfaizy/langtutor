import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resolveWordImage,
  regenerateWordImage,
  proactiveGenerateWordImage,
} from "@/lib/image/resolve-word-image";
import { MockImageGenerator } from "@/lib/image/mock-image-generator";
import { buildKidIllustrationPrompt } from "@/lib/image/prompts";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

const IMAGE_KEY = { kind: "image" as const, key: "apple", style: "kid-illustration" };

beforeEach(() => {
  db = new LangTutorDB(`resolve-word-image-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

describe("resolveWordImage", () => {
  it("invokes the generator exactly once on a store miss and stores a pending asset with prompt", async () => {
    const generator = new MockImageGenerator({ data: new Uint8Array([42]) });

    const first = await resolveWordImage(repo, generator, "Apple");
    const second = await resolveWordImage(repo, generator, "apple");

    expect(generator.calls).toHaveLength(1);
    expect(generator.calls[0]?.prompt).toBe(buildKidIllustrationPrompt("apple"));
    expect(first).toBeUndefined();
    expect(second).toBeUndefined();

    const stored = await repo.getMediaAssetRaw(IMAGE_KEY);
    expect(stored?.data).toEqual(new Uint8Array([42]));
    expect(stored?.approvalStatus).toBe("pending");
    expect(stored?.source).toBe("generated");
    expect(stored?.prompt).toBe(buildKidIllustrationPrompt("apple"));
    expect(await repo.getMediaAsset(IMAGE_KEY)).toBeUndefined();
  });

  it("returns approved assets from the store without calling the generator", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "cat",
      style: "kid-illustration",
      data: new Uint8Array([7]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "approved",
      prompt: buildKidIllustrationPrompt("cat"),
    });

    const generator = new MockImageGenerator();
    const factory = vi.fn(async () => generator);
    const resolved = await resolveWordImage(repo, factory, "cat");

    expect(factory).not.toHaveBeenCalled();
    expect(generator.calls).toHaveLength(0);
    expect(resolved?.data).toEqual(new Uint8Array([7]));
  });

  it("does not invoke a generator factory for pending cache hits", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "dog",
      style: "kid-illustration",
      data: new Uint8Array([3]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
      prompt: null,
    });

    const factory = vi.fn(async () => {
      throw new Error("NVIDIA should not be contacted for pending hits");
    });
    const resolved = await resolveWordImage(repo, factory, "dog");

    expect(factory).not.toHaveBeenCalled();
    expect(resolved).toBeUndefined();
  });

  it("does not return pending cache hits to learners", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "dog",
      style: "kid-illustration",
      data: new Uint8Array([3]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
      prompt: null,
    });

    const generator = new MockImageGenerator();
    const resolved = await resolveWordImage(repo, generator, "dog");

    expect(generator.calls).toHaveLength(0);
    expect(resolved).toBeUndefined();
  });
});

describe("regenerateWordImage", () => {
  it("replaces a pending asset with a freshly generated one and stores the default prompt", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "ball",
      style: "kid-illustration",
      data: new Uint8Array([1]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
      prompt: "old prompt",
    });

    const generator = new MockImageGenerator({ data: new Uint8Array([99]) });
    const regenerated = await regenerateWordImage(repo, generator, "ball");

    expect(generator.calls).toHaveLength(1);
    expect(generator.calls[0]?.prompt).toBe(buildKidIllustrationPrompt("ball"));
    expect(regenerated.data).toEqual(new Uint8Array([99]));
    expect(regenerated.approvalStatus).toBe("pending");
    expect(regenerated.prompt).toBe(buildKidIllustrationPrompt("ball"));
    expect(
      await repo.getMediaAssetRaw({ kind: "image", key: "ball", style: "kid-illustration" }),
    ).toEqual(regenerated);
    expect(
      await repo.getMediaAsset({ kind: "image", key: "ball", style: "kid-illustration" }),
    ).toBeUndefined();
  });

  it("accepts a prompt override, persists it, and hides the image until approve", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "apple",
      style: "kid-illustration",
      data: new Uint8Array([1]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "curated-pack",
      approvalStatus: "approved",
      prompt: null,
    });

    const override = "A bright red apple cartoon for toddlers, plain white background.";
    const generator = new MockImageGenerator({ data: new Uint8Array([55]) });
    const regenerated = await regenerateWordImage(
      repo,
      generator,
      "apple",
      "kid-illustration",
      override,
    );

    expect(generator.calls[0]?.prompt).toBe(override);
    expect(regenerated.source).toBe("generated");
    expect(regenerated.approvalStatus).toBe("pending");
    expect(regenerated.prompt).toBe(override);
    expect(await repo.getMediaAsset(IMAGE_KEY)).toBeUndefined();

    await repo.approveMediaAsset(IMAGE_KEY);
    const approved = await resolveWordImage(repo, generator, "apple");
    expect(approved?.data).toEqual(new Uint8Array([55]));
    expect(approved?.prompt).toBe(override);
    expect(generator.calls).toHaveLength(1);
  });

  it("keeps the previous asset when generation fails", async () => {
    const previous = {
      kind: "image" as const,
      key: "ball",
      style: "kid-illustration",
      data: new Uint8Array([1]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated" as const,
      approvalStatus: "approved" as const,
      prompt: "keep me",
    };
    await repo.putMediaAsset(previous);

    const generator = {
      generate: async () => {
        throw new Error("provider down");
      },
    };
    await expect(regenerateWordImage(repo, generator, "ball")).rejects.toThrow("provider down");

    const stored = await repo.getMediaAssetRaw({
      kind: "image",
      key: "ball",
      style: "kid-illustration",
    });
    expect(stored?.data).toEqual(new Uint8Array([1]));
    expect(stored?.approvalStatus).toBe("approved");
    expect(stored?.prompt).toBe("keep me");
  });
});

describe("proactiveGenerateWordImage", () => {
  it("creates a pending generated asset with stored prompt for a missing word", async () => {
    const generator = new MockImageGenerator({ data: new Uint8Array([77]) });
    const created = await proactiveGenerateWordImage(repo, generator, "Xylophone");

    expect(generator.calls).toHaveLength(1);
    expect(generator.calls[0]?.prompt).toBe(buildKidIllustrationPrompt("xylophone"));
    expect(created.key).toBe("xylophone");
    expect(created.approvalStatus).toBe("pending");
    expect(created.source).toBe("generated");
    expect(created.prompt).toBe(buildKidIllustrationPrompt("xylophone"));
    expect(created.data).toEqual(new Uint8Array([77]));
    expect(
      await repo.getMediaAssetRaw({
        kind: "image",
        key: "xylophone",
        style: "kid-illustration",
      }),
    ).toEqual(created);
    expect(
      await repo.getMediaAsset({ kind: "image", key: "xylophone", style: "kid-illustration" }),
    ).toBeUndefined();
  });

  it("persists a prompt override and serves after approve", async () => {
    const override = "A colorful xylophone for preschoolers on a white background.";
    const generator = new MockImageGenerator({ data: new Uint8Array([11]) });
    const created = await proactiveGenerateWordImage(
      repo,
      generator,
      "xylophone",
      "kid-illustration",
      override,
    );

    expect(created.prompt).toBe(override);
    expect(generator.calls[0]?.prompt).toBe(override);

    const key = { kind: "image" as const, key: "xylophone", style: "kid-illustration" };
    await repo.approveMediaAsset(key);
    const approved = await resolveWordImage(repo, generator, "xylophone");
    expect(approved?.data).toEqual(new Uint8Array([11]));
    expect(approved?.prompt).toBe(override);
    expect(generator.calls).toHaveLength(1);
  });

  it("rejects when a media row already exists without calling the generator", async () => {
    await repo.putMediaAsset({
      kind: "image",
      key: "apple",
      style: "kid-illustration",
      data: new Uint8Array([1]),
      mimeType: "image/png",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "curated-pack",
      approvalStatus: "approved",
      prompt: null,
    });

    const generator = new MockImageGenerator();
    await expect(proactiveGenerateWordImage(repo, generator, "Apple")).rejects.toThrow(
      /already exists.*regenerate/i,
    );
    expect(generator.calls).toHaveLength(0);
  });
});
