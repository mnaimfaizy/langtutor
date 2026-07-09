import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import { MockTtsSynthesizer } from "@/lib/tts/mock-tts-synthesizer";
import { resolveWordAudio } from "@/lib/tts/resolve-word-audio";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

beforeEach(() => {
  db = new LangTutorDB(`resolve-word-audio-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

describe("resolveWordAudio", () => {
  it("invokes the synthesizer exactly once on a store miss and serves the store on the next lookup", async () => {
    const synthesizer = new MockTtsSynthesizer({ data: new Uint8Array([42]) });

    const first = await resolveWordAudio(repo, synthesizer, "Apple");
    const second = await resolveWordAudio(repo, synthesizer, "apple");

    expect(synthesizer.calls).toHaveLength(1);
    expect(synthesizer.calls[0]?.text).toBe("apple");
    expect(first.data).toEqual(new Uint8Array([42]));
    expect(second.data).toEqual(new Uint8Array([42]));
    expect(await repo.getMediaAsset({ kind: "audio", key: "apple", style: "default" })).toEqual(
      first,
    );
  });

  it("never invokes the synthesizer on a cache hit", async () => {
    await repo.putMediaAsset({
      kind: "audio",
      key: "cat",
      style: "default",
      data: new Uint8Array([7]),
      mimeType: "audio/wav",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "approved",
    });

    const synthesizer = new MockTtsSynthesizer();
    const factory = vi.fn(async () => synthesizer);
    const resolved = await resolveWordAudio(repo, factory, "cat");

    expect(factory).not.toHaveBeenCalled();
    expect(synthesizer.calls).toHaveLength(0);
    expect(resolved.data).toEqual(new Uint8Array([7]));
  });

  it("forwards TTS options to the synthesizer on a store miss", async () => {
    const synthesizer = new MockTtsSynthesizer();

    await resolveWordAudio(repo, synthesizer, "dog", "default", {
      rate: 1.2,
      voiceUri: "hannah",
    });

    expect(synthesizer.calls[0]?.options).toEqual({ rate: 1.2, voiceUri: "hannah" });
  });
});
