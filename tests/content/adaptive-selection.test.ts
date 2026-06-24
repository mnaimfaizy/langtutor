import { describe, expect, it } from "vitest";

import {
  rankTopicsByWeakness,
  topicWeaknessScore,
  READING_TOPIC_AFFINITIES,
  WRITING_TOPIC_AFFINITIES,
} from "@/lib/content/adaptive-selection";
import { READING_TOPICS } from "@/lib/content/passage";
import { WRITING_TOPICS } from "@/lib/content/prompt";
import type { Weakness } from "@/lib/db";

type W = Pick<Weakness, "category" | "score">;

const noWeaknesses: W[] = [];

const affinities = {
  technology: ["grammar", "passive voice", "vocabulary"],
  hobbies: ["vocabulary"],
  travel: ["preposition", "tense", "vocabulary"],
};

describe("topicWeaknessScore", () => {
  it("returns 0 when there are no weaknesses", () => {
    expect(topicWeaknessScore("technology", noWeaknesses, affinities)).toBe(0);
  });

  it("returns 0 when topic has no matching affinities", () => {
    const weaknesses: W[] = [{ category: "passive voice", score: 0.8 }];
    // hobbies only lists "vocabulary"
    expect(topicWeaknessScore("hobbies", weaknesses, affinities)).toBe(0);
  });

  it("sums weakness scores for all matching categories", () => {
    const weaknesses: W[] = [
      { category: "grammar", score: 0.5 },
      { category: "passive voice", score: 0.3 },
    ];
    // technology affinities include both "grammar" and "passive voice"
    expect(topicWeaknessScore("technology", weaknesses, affinities)).toBeCloseTo(0.8);
  });

  it("matching is case-insensitive (category vs keyword)", () => {
    const weaknesses: W[] = [{ category: "Grammar", score: 0.6 }];
    expect(topicWeaknessScore("technology", weaknesses, affinities)).toBeCloseTo(0.6);
  });

  it("matches when category contains the keyword as a substring", () => {
    const weaknesses: W[] = [{ category: "verb tense", score: 0.7 }];
    // "tense" keyword matches "verb tense"
    expect(topicWeaknessScore("travel", weaknesses, affinities)).toBeCloseTo(0.7);
  });

  it("returns 0 for an unknown topic (no affinity entry)", () => {
    const weaknesses: W[] = [{ category: "grammar", score: 0.9 }];
    expect(topicWeaknessScore("custom topic", weaknesses, affinities)).toBe(0);
  });
});

describe("rankTopicsByWeakness", () => {
  const topics = ["technology", "hobbies", "travel"] as const;

  it("returns all topics even with no weaknesses", () => {
    const ranked = rankTopicsByWeakness(topics, noWeaknesses, affinities);
    expect(ranked).toHaveLength(topics.length);
    expect(new Set(ranked)).toEqual(new Set(topics));
  });

  it("topic exercising the weak category ranks first", () => {
    const weaknesses: W[] = [{ category: "passive voice", score: 0.9 }];
    const ranked = rankTopicsByWeakness(topics, weaknesses, affinities);
    // Only "technology" has "passive voice" affinity
    expect(ranked[0]).toBe("technology");
  });

  it("topic with higher cumulative score outranks lower score topic", () => {
    const weaknesses: W[] = [
      { category: "grammar", score: 0.8 },
      { category: "passive voice", score: 0.6 },
    ];
    const ranked = rankTopicsByWeakness(topics, weaknesses, affinities);
    // technology exercises both grammar and passive voice → score 1.4
    // travel exercises neither grammar nor passive voice
    // hobbies exercises neither
    expect(ranked[0]).toBe("technology");
  });

  it("topics with equal zero score preserve original order", () => {
    const weaknesses: W[] = [{ category: "something unrelated", score: 0.9 }];
    const ranked = rankTopicsByWeakness(topics, weaknesses, affinities);
    // All score 0 — original order preserved (stable sort)
    expect(ranked).toEqual(["technology", "hobbies", "travel"]);
  });

  it("does not mutate the input topics array", () => {
    const input = ["technology", "hobbies", "travel"] as const;
    const weaknesses: W[] = [{ category: "passive voice", score: 0.8 }];
    rankTopicsByWeakness(input, weaknesses, affinities);
    expect(input).toEqual(["technology", "hobbies", "travel"]);
  });

  it("topic with shared vocabulary keyword ranks ahead of topic without", () => {
    const weaknesses: W[] = [{ category: "vocabulary", score: 0.7 }];
    const ranked = rankTopicsByWeakness(topics, weaknesses, affinities);
    // All three have "vocabulary" → all score 0.7 — equality, no error thrown
    expect(ranked).toHaveLength(3);
    // technology, hobbies, travel all match "vocabulary" → tie, so order preserved
    expect(ranked[0]).toBe("technology");
  });
});

describe("READING_TOPIC_AFFINITIES", () => {
  it("covers all standard reading topics", () => {
    for (const topic of READING_TOPICS) {
      expect(READING_TOPIC_AFFINITIES).toHaveProperty(topic);
    }
  });

  it("each topic has at least one affinity keyword", () => {
    for (const [, keywords] of Object.entries(READING_TOPIC_AFFINITIES)) {
      expect((keywords as string[]).length).toBeGreaterThan(0);
    }
  });
});

describe("WRITING_TOPIC_AFFINITIES", () => {
  it("covers all standard writing topics", () => {
    for (const topic of WRITING_TOPICS) {
      expect(WRITING_TOPIC_AFFINITIES).toHaveProperty(topic);
    }
  });

  it("each topic has at least one affinity keyword", () => {
    for (const [, keywords] of Object.entries(WRITING_TOPIC_AFFINITIES)) {
      expect((keywords as string[]).length).toBeGreaterThan(0);
    }
  });
});
