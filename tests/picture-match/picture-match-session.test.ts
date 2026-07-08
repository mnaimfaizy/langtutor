import { describe, expect, it } from "vitest";

import {
  PICTURE_MATCH_CHOICE_COUNT,
  buildPictureMatchChoices,
  clampPictureMatchRoundIndex,
  isLastPictureMatchRound,
  isPictureMatchComplete,
  nextPictureMatchRoundIndex,
  pictureMatchAudioKeyAt,
  pictureMatchDirectionAt,
  pictureMatchRoundAt,
  scorePictureMatchTap,
} from "@/lib/picture-match/picture-match-session";
import { PICTURE_MATCH_ROUND_COUNT, PICTURE_MATCH_ROUNDS } from "@/lib/picture-match/vocab";

describe("pictureMatchRoundAt", () => {
  it("returns each curated round definition", () => {
    expect(pictureMatchRoundAt(0)?.def).toEqual(PICTURE_MATCH_ROUNDS[0]);
    expect(pictureMatchRoundAt(PICTURE_MATCH_ROUND_COUNT - 1)?.def.targetWord).toBe("whale");
  });

  it("returns undefined for out-of-range indices", () => {
    expect(pictureMatchRoundAt(-1)).toBeUndefined();
    expect(pictureMatchRoundAt(PICTURE_MATCH_ROUND_COUNT)).toBeUndefined();
  });
});

describe("pictureMatchDirectionAt", () => {
  it("alternates picture-to-word and word-to-picture rounds", () => {
    expect(pictureMatchDirectionAt(0)).toBe("picture-to-word");
    expect(pictureMatchDirectionAt(1)).toBe("word-to-picture");
    expect(pictureMatchDirectionAt(2)).toBe("picture-to-word");
  });
});

describe("pictureMatchAudioKeyAt", () => {
  it("returns the audio key only for word-to-picture rounds", () => {
    expect(pictureMatchAudioKeyAt(0)).toBeUndefined();
    expect(pictureMatchAudioKeyAt(1)).toBe("dog");
    expect(pictureMatchAudioKeyAt(3)).toBe("ball");
  });
});

describe("scorePictureMatchTap", () => {
  it("marks the target as correct for picture-to-word rounds", () => {
    expect(scorePictureMatchTap("cat", 0)).toBe("correct");
  });

  it("marks the target as correct for word-to-picture rounds", () => {
    expect(scorePictureMatchTap("dog", 1)).toBe("correct");
  });

  it("marks other choices as incorrect", () => {
    expect(scorePictureMatchTap("fish", 0)).toBe("incorrect");
    expect(scorePictureMatchTap("cat", 1)).toBe("incorrect");
  });
});

describe("buildPictureMatchChoices", () => {
  it("returns the requested number of unique choices", () => {
    const choices = buildPictureMatchChoices(0);
    expect(choices).toHaveLength(PICTURE_MATCH_CHOICE_COUNT);
    expect(new Set(choices.map((c) => c.word)).size).toBe(PICTURE_MATCH_CHOICE_COUNT);
  });

  it("always includes the correct answer for every round", () => {
    for (let i = 0; i < PICTURE_MATCH_ROUND_COUNT; i++) {
      const target = PICTURE_MATCH_ROUNDS[i]!.targetWord;
      const words = buildPictureMatchChoices(i).map((c) => c.word);
      expect(words).toContain(target);
    }
  });

  it("is deterministic for the same round index", () => {
    expect(buildPictureMatchChoices(3)).toEqual(buildPictureMatchChoices(3));
    expect(buildPictureMatchChoices(7)).not.toEqual(buildPictureMatchChoices(3));
  });
});

describe("nextPictureMatchRoundIndex", () => {
  it("walks through every round except the last", () => {
    for (let i = 0; i < PICTURE_MATCH_ROUND_COUNT - 1; i++) {
      expect(nextPictureMatchRoundIndex(i)).toBe(i + 1);
    }
  });

  it("returns null on the last round", () => {
    expect(nextPictureMatchRoundIndex(PICTURE_MATCH_ROUND_COUNT - 1)).toBeNull();
  });
});

describe("isLastPictureMatchRound", () => {
  it("is only true for the final round", () => {
    expect(isLastPictureMatchRound(0)).toBe(false);
    expect(isLastPictureMatchRound(PICTURE_MATCH_ROUND_COUNT - 1)).toBe(true);
  });
});

describe("isPictureMatchComplete", () => {
  it("is only true when finishing from the last round", () => {
    expect(isPictureMatchComplete(0)).toBe(false);
    expect(isPictureMatchComplete(PICTURE_MATCH_ROUND_COUNT - 1)).toBe(true);
  });
});

describe("clampPictureMatchRoundIndex", () => {
  it("clamps invalid values into range", () => {
    expect(clampPictureMatchRoundIndex(-3)).toBe(0);
    expect(clampPictureMatchRoundIndex(99)).toBe(PICTURE_MATCH_ROUND_COUNT - 1);
    expect(clampPictureMatchRoundIndex(4.9)).toBe(4);
  });
});
