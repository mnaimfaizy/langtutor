import { describe, expect, it } from "vitest";

import {
  decodeSharedPathTargetVocab,
  encodeSharedPathTargetVocab,
  flattenTargetVocabItems,
} from "@/lib/path/shared-path-target-vocab";

describe("shared-path target vocab encode/decode", () => {
  it("round-trips legacy string arrays", () => {
    const encoded = encodeSharedPathTargetVocab(["Cat", "sun", "pig"]);
    expect(JSON.parse(encoded)).toEqual(["cat", "sun", "pig"]);
    expect(decodeSharedPathTargetVocab(encoded)).toEqual({
      words: ["cat", "sun", "pig"],
      senses: {},
    });
  });

  it("embeds senses when present", () => {
    const encoded = encodeSharedPathTargetVocab(["mat", "cup"], {
      mat: "a soft floor covering",
      cup: "a drinking cup",
    });
    const decoded = decodeSharedPathTargetVocab(encoded);
    expect(decoded.words).toEqual(["mat", "cup"]);
    expect(decoded.senses).toEqual({
      mat: "a soft floor covering",
      cup: "a drinking cup",
    });
  });

  it("flattens draft vocab items", () => {
    expect(
      flattenTargetVocabItems([
        { word: "Cat", sense: "a pet cat" },
        { word: "cat", sense: "ignored duplicate" },
        { word: "sun", sense: "the sun in the sky" },
      ]),
    ).toEqual({
      words: ["cat", "sun"],
      senses: { cat: "a pet cat", sun: "the sun in the sky" },
    });
  });
});
