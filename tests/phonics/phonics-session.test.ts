import { describe, expect, it } from "vitest";

import { ALPHABET_ENTRIES, ALPHABET_LENGTH } from "@/lib/alphabet/vocab";
import {
  PHONICS_CHOICE_COUNT,
  buildPhonicsChoices,
  clampPhonicsRoundIndex,
  isLastPhonicsRound,
  isPhonicsComplete,
  nextPhonicsRoundIndex,
  phonicsRoundAt,
  scorePhonicsTap,
} from "@/lib/phonics/phonics-session";

describe("phonicsRoundAt", () => {
  it("returns each alphabet entry as a round", () => {
    expect(phonicsRoundAt(0)?.target).toEqual(ALPHABET_ENTRIES[0]);
    expect(phonicsRoundAt(25)?.target.letter).toBe("z");
  });

  it("returns undefined for out-of-range indices", () => {
    expect(phonicsRoundAt(-1)).toBeUndefined();
    expect(phonicsRoundAt(ALPHABET_LENGTH)).toBeUndefined();
  });
});

describe("scorePhonicsTap", () => {
  it("marks the target letter as correct", () => {
    expect(scorePhonicsTap("a", 0)).toBe("correct");
    expect(scorePhonicsTap("A", 0)).toBe("correct");
  });

  it("marks other letters as incorrect", () => {
    expect(scorePhonicsTap("b", 0)).toBe("incorrect");
  });
});

describe("buildPhonicsChoices", () => {
  it("returns the requested number of unique letter choices", () => {
    const choices = buildPhonicsChoices(0);
    expect(choices).toHaveLength(PHONICS_CHOICE_COUNT);
    expect(new Set(choices.map((c) => c.letter)).size).toBe(PHONICS_CHOICE_COUNT);
  });

  it("always includes the correct letter for the round", () => {
    for (let i = 0; i < ALPHABET_LENGTH; i++) {
      const target = ALPHABET_ENTRIES[i]!.letter;
      const letters = buildPhonicsChoices(i).map((c) => c.letter);
      expect(letters).toContain(target);
    }
  });

  it("is deterministic for the same round index", () => {
    expect(buildPhonicsChoices(3)).toEqual(buildPhonicsChoices(3));
    expect(buildPhonicsChoices(12)).not.toEqual(buildPhonicsChoices(3));
  });
});

describe("nextPhonicsRoundIndex", () => {
  it("walks through every round except the last", () => {
    for (let i = 0; i < ALPHABET_LENGTH - 1; i++) {
      expect(nextPhonicsRoundIndex(i)).toBe(i + 1);
    }
  });

  it("returns null on the last round", () => {
    expect(nextPhonicsRoundIndex(ALPHABET_LENGTH - 1)).toBeNull();
  });
});

describe("isLastPhonicsRound", () => {
  it("is only true for the final round", () => {
    expect(isLastPhonicsRound(0)).toBe(false);
    expect(isLastPhonicsRound(ALPHABET_LENGTH - 1)).toBe(true);
  });
});

describe("isPhonicsComplete", () => {
  it("is only true when finishing from the last round", () => {
    expect(isPhonicsComplete(0)).toBe(false);
    expect(isPhonicsComplete(ALPHABET_LENGTH - 1)).toBe(true);
  });
});

describe("word-anchored densification", () => {
  it("exposes anchorWord and letter target for each vocab round", () => {
    const config = {
      wordRounds: [
        { word: "cat", alphabetIndex: 2 },
        { word: "sun", alphabetIndex: 18 },
      ],
    };
    expect(phonicsRoundAt(0, config)?.anchorWord).toBe("cat");
    expect(phonicsRoundAt(0, config)?.target.letter).toBe("c");
    expect(phonicsRoundAt(1, config)?.anchorWord).toBe("sun");
    expect(scorePhonicsTap("c", 0, config)).toBe("correct");
    expect(scorePhonicsTap("s", 0, config)).toBe("incorrect");
  });
});

describe("clampPhonicsRoundIndex", () => {
  it("clamps invalid values into range", () => {
    expect(clampPhonicsRoundIndex(-3)).toBe(0);
    expect(clampPhonicsRoundIndex(99)).toBe(ALPHABET_LENGTH - 1);
    expect(clampPhonicsRoundIndex(4.9)).toBe(4);
  });
});
