import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSingleEmbedding } from "@/lib/content/client-embeddings";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchSingleEmbedding", () => {
  it("returns undefined when the embeddings request never settles (timeout)", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const pending = fetchSingleEmbedding("hello", 50);
    await vi.advanceTimersByTimeAsync(50);
    await expect(pending).resolves.toBeUndefined();
  });

  it("returns the first embedding vector on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          embeddings: [[0.1, 0.2, 0.3]],
        }),
      ),
    );

    await expect(fetchSingleEmbedding("hello")).resolves.toEqual([0.1, 0.2, 0.3]);
  });
});
