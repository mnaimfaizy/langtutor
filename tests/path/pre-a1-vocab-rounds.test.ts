import { describe, expect, it } from "vitest";

import {
  buildListenTapRoundsFromVocab,
  buildPhonicsVocabSession,
  buildPictureMatchRoundsFromVocab,
  buildPictureMatchVocabSession,
  phonicsLetterIndicesFromVocab,
  phonicsWordRoundsFromVocab,
} from "@/lib/path/pre-a1-vocab-rounds";
import {
  buildPictureMatchChoices,
  pictureMatchRoundAt,
  pictureMatchRoundCount,
} from "@/lib/picture-match/picture-match-session";
import {
  buildListenTapChoices,
  listenTapRoundAt,
  listenTapRoundCount,
} from "@/lib/listen-tap/listen-tap-session";
import { phonicsRoundAt, phonicsRoundCount } from "@/lib/phonics/phonics-session";

describe("pre-a1 vocab rounds", () => {
  it("builds alternating picture-match rounds from target vocab", () => {
    const rounds = buildPictureMatchRoundsFromVocab(["Pan", "cup", "mug"]);
    expect(rounds).toHaveLength(3);
    expect(rounds[0]).toMatchObject({
      direction: "picture-to-word",
      targetWord: "pan",
    });
    expect(rounds[1]).toMatchObject({
      direction: "word-to-picture",
      targetWord: "cup",
      audioKey: "cup",
    });
  });

  it("builds listen-tap word rounds from target vocab", () => {
    const rounds = buildListenTapRoundsFromVocab(["cat", "mat"]);
    expect(rounds).toEqual([
      {
        promptKind: "word",
        prompt: "Tap the picture for this word!",
        audioKey: "cat",
        targetWord: "cat",
      },
      {
        promptKind: "word",
        prompt: "Tap the picture for this word!",
        audioKey: "mat",
        targetWord: "mat",
      },
    ]);
  });

  it("drives picture-match session helpers from vocab config", () => {
    const session = buildPictureMatchVocabSession(["pan", "cup"]);
    expect(session).not.toBeNull();
    expect(pictureMatchRoundCount(session!)).toBe(2);
    expect(pictureMatchRoundAt(0, session!)?.def.targetWord).toBe("pan");
    const choices = buildPictureMatchChoices(0, 4, session!);
    expect(choices.map((c) => c.word)).toContain("pan");
    expect(choices).toHaveLength(4);
  });

  it("drives listen-tap session helpers from vocab config", () => {
    const session = {
      rounds: buildListenTapRoundsFromVocab(["dog", "fish"]),
      optionPool: ["dog", "fish", "cat", "ball"],
    };
    expect(listenTapRoundCount(session)).toBe(2);
    expect(listenTapRoundAt(1, session)?.def.targetWord).toBe("fish");
    expect(buildListenTapChoices(1, 4, session).map((c) => c.word)).toContain("fish");
  });

  it("maps phonics vocab words to first-letter alphabet indices", () => {
    const indices = phonicsLetterIndicesFromVocab(["cat", "sat", "mat", "cup"]);
    // one index per word (c, s, m, c)
    expect(indices).toEqual([2, 18, 12, 2]);
  });

  it("builds word-anchored phonics rounds (one per vocab word)", () => {
    const rounds = phonicsWordRoundsFromVocab(["cat", "sun", "pig"]);
    expect(rounds).toEqual([
      { word: "cat", alphabetIndex: 2 },
      { word: "sun", alphabetIndex: 18 },
      { word: "pig", alphabetIndex: 15 },
    ]);
    const session = buildPhonicsVocabSession(["cat", "sun", "pig"]);
    expect(session).not.toBeNull();
    expect(phonicsRoundCount(session!)).toBe(3);
    expect(phonicsRoundAt(0, session!)?.anchorWord).toBe("cat");
    expect(phonicsRoundAt(0, session!)?.target.letter).toBe("c");
    expect(phonicsRoundAt(1, session!)?.anchorWord).toBe("sun");
  });
});
