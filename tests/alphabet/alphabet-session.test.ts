import { describe, expect, it } from "vitest";

import {
  alphabetEntryAt,
  canAdvanceAlphabet,
  clampAlphabetIndex,
  isAlphabetComplete,
  isLastAlphabetIndex,
  nextAlphabetIndex,
} from "@/lib/alphabet/alphabet-session";
import { ALPHABET_ENTRIES, ALPHABET_LENGTH } from "@/lib/alphabet/vocab";

describe("alphabetEntryAt", () => {
  it("returns each letter in order", () => {
    expect(alphabetEntryAt(0)).toEqual(ALPHABET_ENTRIES[0]);
    expect(alphabetEntryAt(25)?.letter).toBe("z");
  });

  it("returns undefined for out-of-range indices", () => {
    expect(alphabetEntryAt(-1)).toBeUndefined();
    expect(alphabetEntryAt(ALPHABET_LENGTH)).toBeUndefined();
  });
});

describe("nextAlphabetIndex", () => {
  it("walks from A through Y", () => {
    for (let i = 0; i < ALPHABET_LENGTH - 1; i++) {
      expect(nextAlphabetIndex(i)).toBe(i + 1);
    }
  });

  it("returns null on the last letter", () => {
    expect(nextAlphabetIndex(ALPHABET_LENGTH - 1)).toBeNull();
  });
});

describe("canAdvanceAlphabet", () => {
  it("is true for every letter except Z", () => {
    expect(canAdvanceAlphabet(0)).toBe(true);
    expect(canAdvanceAlphabet(ALPHABET_LENGTH - 2)).toBe(true);
    expect(canAdvanceAlphabet(ALPHABET_LENGTH - 1)).toBe(false);
  });
});

describe("isLastAlphabetIndex", () => {
  it("is only true for Z", () => {
    expect(isLastAlphabetIndex(0)).toBe(false);
    expect(isLastAlphabetIndex(ALPHABET_LENGTH - 1)).toBe(true);
  });
});

describe("isAlphabetComplete", () => {
  it("is only true when finishing from the last letter", () => {
    expect(isAlphabetComplete(0)).toBe(false);
    expect(isAlphabetComplete(ALPHABET_LENGTH - 1)).toBe(true);
  });
});

describe("clampAlphabetIndex", () => {
  it("clamps invalid values into range", () => {
    expect(clampAlphabetIndex(-3)).toBe(0);
    expect(clampAlphabetIndex(99)).toBe(ALPHABET_LENGTH - 1);
    expect(clampAlphabetIndex(4.9)).toBe(4);
  });
});
