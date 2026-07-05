import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GroqTranscriber } from "@/lib/transcriber/groq-transcriber";

describe("GroqTranscriber", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts audio to Groq whisper-large-v3 and returns trimmed text", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ text: " hello world " }), { status: 200 }));

    const t = new GroqTranscriber("gsk_test");
    const result = await t.transcribe(new Blob(["audio"], { type: "audio/wav" }));

    expect(result).toBe("hello world");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer gsk_test" },
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3");
    expect(form.get("response_format")).toBe("json");
  });

  it("throws when Groq is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const t = new GroqTranscriber("gsk_test");
    await expect(t.transcribe(new Blob([]))).rejects.toThrow("Groq STT not reachable");
  });

  it("throws on non-OK HTTP status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 500 }));
    const t = new GroqTranscriber("gsk_test");
    await expect(t.transcribe(new Blob([]))).rejects.toThrow("Groq STT returned 500");
  });
});
