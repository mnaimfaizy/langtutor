import { describe, expect, it } from "vitest";

import { deckWordImageKey, deckWordImageUrl, resolveDeckCardLayout } from "@/lib/deck/card-image";

describe("deckWordImageKey", () => {
  it("normalizes the word and uses the kid illustration style", () => {
    expect(deckWordImageKey(" Apple ")).toEqual({
      kind: "image",
      key: "apple",
      style: "kid-illustration",
    });
  });
});

describe("deckWordImageUrl", () => {
  it("builds a same-origin resolve URL for the normalized word", () => {
    expect(deckWordImageUrl("Apple")).toBe("/api/image/resolve?word=apple&style=kid-illustration");
  });
});

describe("resolveDeckCardLayout", () => {
  it("falls back to text-only when no approved image exists", () => {
    expect(resolveDeckCardLayout("kid", false)).toBe("text-only");
    expect(resolveDeckCardLayout("adult", false)).toBe("text-only");
  });

  it("uses picture-first in kid mode when an image exists", () => {
    expect(resolveDeckCardLayout("kid", true)).toBe("picture-first");
  });

  it("uses accent layout in adult mode when an image exists", () => {
    expect(resolveDeckCardLayout("adult", true)).toBe("accent");
  });
});
