import { describe, expect, it } from "vitest";

import {
  LISTEN_TAP_CHOICE_COUNT,
  buildListenTapChoices,
  clampListenTapRoundIndex,
  isLastListenTapRound,
  isListenTapComplete,
  listenTapRoundAt,
  nextListenTapRoundIndex,
  scoreListenTapTap,
} from "@/lib/listen-tap/listen-tap-session";
import { LISTEN_TAP_ROUND_COUNT, LISTEN_TAP_ROUNDS } from "@/lib/listen-tap/vocab";

describe("listenTapRoundAt", () => {
  it("returns each curated round definition", () => {
    expect(listenTapRoundAt(0)?.def).toEqual(LISTEN_TAP_ROUNDS[0]);
    expect(listenTapRoundAt(LISTEN_TAP_ROUND_COUNT - 1)?.def.targetWord).toBe("kite");
  });

  it("returns undefined for out-of-range indices", () => {
    expect(listenTapRoundAt(-1)).toBeUndefined();
    expect(listenTapRoundAt(LISTEN_TAP_ROUND_COUNT)).toBeUndefined();
  });
});

describe("scoreListenTapTap", () => {
  it("marks the target picture word as correct", () => {
    expect(scoreListenTapTap("cat", 0)).toBe("correct");
  });

  it("marks other picture words as incorrect", () => {
    expect(scoreListenTapTap("dog", 0)).toBe("incorrect");
  });
});

describe("buildListenTapChoices", () => {
  it("returns the requested number of unique picture choices", () => {
    const choices = buildListenTapChoices(0);
    expect(choices).toHaveLength(LISTEN_TAP_CHOICE_COUNT);
    expect(new Set(choices.map((c) => c.word)).size).toBe(LISTEN_TAP_CHOICE_COUNT);
  });

  it("always includes the correct picture for the round", () => {
    for (let i = 0; i < LISTEN_TAP_ROUND_COUNT; i++) {
      const target = LISTEN_TAP_ROUNDS[i]!.targetWord;
      const words = buildListenTapChoices(i).map((c) => c.word);
      expect(words).toContain(target);
    }
  });

  it("is deterministic for the same round index", () => {
    expect(buildListenTapChoices(3)).toEqual(buildListenTapChoices(3));
    expect(buildListenTapChoices(7)).not.toEqual(buildListenTapChoices(3));
  });
});

describe("nextListenTapRoundIndex", () => {
  it("walks through every round except the last", () => {
    for (let i = 0; i < LISTEN_TAP_ROUND_COUNT - 1; i++) {
      expect(nextListenTapRoundIndex(i)).toBe(i + 1);
    }
  });

  it("returns null on the last round", () => {
    expect(nextListenTapRoundIndex(LISTEN_TAP_ROUND_COUNT - 1)).toBeNull();
  });
});

describe("isLastListenTapRound", () => {
  it("is only true for the final round", () => {
    expect(isLastListenTapRound(0)).toBe(false);
    expect(isLastListenTapRound(LISTEN_TAP_ROUND_COUNT - 1)).toBe(true);
  });
});

describe("isListenTapComplete", () => {
  it("is only true when finishing from the last round", () => {
    expect(isListenTapComplete(0)).toBe(false);
    expect(isListenTapComplete(LISTEN_TAP_ROUND_COUNT - 1)).toBe(true);
  });
});

describe("clampListenTapRoundIndex", () => {
  it("clamps invalid values into range", () => {
    expect(clampListenTapRoundIndex(-3)).toBe(0);
    expect(clampListenTapRoundIndex(99)).toBe(LISTEN_TAP_ROUND_COUNT - 1);
    expect(clampListenTapRoundIndex(4.9)).toBe(4);
  });
});
