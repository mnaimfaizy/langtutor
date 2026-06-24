import { describe, expect, it } from "vitest";

import { MockTranscriber } from "@/lib/transcriber/mock-transcriber";

describe("MockTranscriber", () => {
  it("returns the canned transcript", async () => {
    const t = new MockTranscriber("the quick brown fox");
    const result = await t.transcribe(new Blob(["audio"], { type: "audio/wav" }));
    expect(result).toBe("the quick brown fox");
  });

  it("defaults to empty string", async () => {
    const t = new MockTranscriber();
    const result = await t.transcribe(new Blob([]));
    expect(result).toBe("");
  });

  it("rejects when constructed with null (simulates Mac unavailable)", async () => {
    const t = new MockTranscriber(null);
    await expect(t.transcribe(new Blob([]))).rejects.toThrow("Mac STT server not reachable");
  });

  it("different instances return independent transcripts", async () => {
    const a = new MockTranscriber("hello");
    const b = new MockTranscriber("world");
    expect(await a.transcribe(new Blob([]))).toBe("hello");
    expect(await b.transcribe(new Blob([]))).toBe("world");
  });
});
