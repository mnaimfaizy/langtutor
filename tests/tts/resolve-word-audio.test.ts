import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { encodeWav } from "@/lib/audio/normalize";
import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import { MockTtsSynthesizer } from "@/lib/tts/mock-tts-synthesizer";
import { resolveWordAudio } from "@/lib/tts/resolve-word-audio";
import {
  TTS_MAX_DURATION_SECONDS,
  applyTtsDurationCap,
  estimateWavDurationSeconds,
  truncateWavToMaxDuration,
} from "@/lib/tts/truncate-audio";

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;

const AUDIO_KEY = { kind: "audio" as const, key: "apple", style: "default" };

function wavSeconds(seconds: number, sampleRate = 16000): Uint8Array {
  return new Uint8Array(encodeWav(new Float32Array(Math.round(sampleRate * seconds)), sampleRate));
}

beforeEach(() => {
  db = new LangTutorDB(`resolve-word-audio-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
});

afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

describe("resolveWordAudio", () => {
  it("invokes the synthesizer exactly once on a store miss and stores a pending asset", async () => {
    const synthesizer = new MockTtsSynthesizer({ data: new Uint8Array([42]) });

    const first = await resolveWordAudio(repo, synthesizer, "Apple");
    const second = await resolveWordAudio(repo, synthesizer, "apple");

    expect(synthesizer.calls).toHaveLength(1);
    expect(synthesizer.calls[0]?.text).toBe("apple");
    expect(first).toBeUndefined();
    expect(second).toBeUndefined();

    const stored = await repo.getMediaAssetRaw(AUDIO_KEY);
    expect(stored?.data).toEqual(new Uint8Array([42]));
    expect(stored?.approvalStatus).toBe("pending");
    expect(stored?.source).toBe("generated");
    expect(await repo.getMediaAsset(AUDIO_KEY)).toBeUndefined();
  });

  it("returns approved assets from the store without calling the synthesizer", async () => {
    await repo.putMediaAsset({
      kind: "audio",
      key: "cat",
      style: "default",
      data: new Uint8Array([7]),
      mimeType: "audio/wav",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "approved",
      prompt: null,
    });

    const synthesizer = new MockTtsSynthesizer();
    const factory = vi.fn(async () => synthesizer);
    const resolved = await resolveWordAudio(repo, factory, "cat");

    expect(factory).not.toHaveBeenCalled();
    expect(synthesizer.calls).toHaveLength(0);
    expect(resolved?.data).toEqual(new Uint8Array([7]));
  });

  it("does not invoke a synthesizer factory for pending cache hits", async () => {
    await repo.putMediaAsset({
      kind: "audio",
      key: "dog",
      style: "default",
      data: new Uint8Array([3]),
      mimeType: "audio/wav",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
      prompt: null,
    });

    const factory = vi.fn(async () => {
      throw new Error("Groq should not be contacted for pending hits");
    });
    const resolved = await resolveWordAudio(repo, factory, "dog");

    expect(factory).not.toHaveBeenCalled();
    expect(resolved).toBeUndefined();
  });

  it("does not return pending cache hits to learners", async () => {
    await repo.putMediaAsset({
      kind: "audio",
      key: "dog",
      style: "default",
      data: new Uint8Array([3]),
      mimeType: "audio/wav",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      source: "generated",
      approvalStatus: "pending",
      prompt: null,
    });

    const synthesizer = new MockTtsSynthesizer();
    const resolved = await resolveWordAudio(repo, synthesizer, "dog");

    expect(synthesizer.calls).toHaveLength(0);
    expect(resolved).toBeUndefined();
  });

  it("forwards TTS options to the synthesizer on a store miss", async () => {
    const synthesizer = new MockTtsSynthesizer();

    await resolveWordAudio(repo, synthesizer, "dog", "default", {
      rate: 1.2,
      voiceUri: "hannah",
    });

    expect(synthesizer.calls[0]?.options).toEqual({ rate: 1.2, voiceUri: "hannah" });
  });

  it("truncates over-long WAV audio before persist", async () => {
    const longWav = wavSeconds(8);
    const synthesizer = new MockTtsSynthesizer({ data: longWav, mimeType: "audio/wav" });

    await resolveWordAudio(repo, synthesizer, "long");

    const stored = await repo.getMediaAssetRaw({ kind: "audio", key: "long", style: "default" });
    expect(stored?.approvalStatus).toBe("pending");
    const duration = estimateWavDurationSeconds(stored!.data);
    expect(duration).not.toBeNull();
    expect(duration!).toBeLessThanOrEqual(TTS_MAX_DURATION_SECONDS + 0.01);
  });

  it("serves previously approved audio after approve without re-synthesis", async () => {
    const synthesizer = new MockTtsSynthesizer({ data: new Uint8Array([9]) });
    const ballKey = { kind: "audio" as const, key: "ball", style: "default" };
    expect(await resolveWordAudio(repo, synthesizer, "ball")).toBeUndefined();

    await repo.approveMediaAsset(ballKey);
    const approved = await resolveWordAudio(repo, synthesizer, "ball");

    expect(synthesizer.calls).toHaveLength(1);
    expect(approved?.data).toEqual(new Uint8Array([9]));
    expect(approved?.approvalStatus).toBe("approved");
  });
});

describe("truncateWavToMaxDuration / applyTtsDurationCap", () => {
  it("leaves short WAV clips unchanged", () => {
    const short = wavSeconds(2);
    expect(truncateWavToMaxDuration(short)).toEqual(short);
    expect(applyTtsDurationCap(short, "audio/wav")).toEqual(short);
  });

  it("truncates WAV longer than the cap to ~5s", () => {
    const long = wavSeconds(12);
    const truncated = truncateWavToMaxDuration(long);
    const duration = estimateWavDurationSeconds(truncated);
    expect(duration).toBeCloseTo(TTS_MAX_DURATION_SECONDS, 1);
    expect(truncated.byteLength).toBeLessThan(long.byteLength);
  });

  it("passes through non-WAV mime types unchanged", () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(applyTtsDurationCap(bytes, "audio/mpeg")).toEqual(bytes);
  });

  it("returns null duration for non-WAV bytes", () => {
    expect(estimateWavDurationSeconds(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
