import type { ReadingTopic } from "./passage";
import type { WritingTopic } from "./prompt";
import type { Weakness } from "@/lib/db";

/**
 * Keywords a reading topic tends to exercise. Used to match errorEvent
 * categories (free-form strings) to topics via case-insensitive substring.
 * Covers grammar constructions, vocabulary, and common feedback categories.
 */
export const READING_TOPIC_AFFINITIES: Record<ReadingTopic, string[]> = {
  "daily routine": ["tense", "simple present", "adverb", "vocabulary", "frequency"],
  travel: ["preposition", "modal", "vocabulary", "tense", "conditionals"],
  "food and cooking": ["vocabulary", "imperative", "quantity", "noun"],
  technology: ["passive", "grammar", "vocabulary", "complex sentence"],
  "nature and animals": ["vocabulary", "adjective", "plural", "tense"],
  "health and exercise": ["modal", "comparative", "vocabulary", "adverb"],
  "work and career": ["conditionals", "modal", "vocabulary", "grammar", "tense"],
  hobbies: ["vocabulary", "present continuous", "gerund"],
  "city life": ["preposition", "article", "vocabulary", "grammar"],
  environment: ["passive", "grammar", "vocabulary", "complex sentence"],
};

/**
 * Keywords a writing topic tends to exercise. Covers grammar constructions,
 * vocabulary, and common writing-feedback error categories.
 */
export const WRITING_TOPIC_AFFINITIES: Record<WritingTopic, string[]> = {
  "personal experience": ["tense", "vocabulary", "grammar", "narrative"],
  "family and friends": ["vocabulary", "adjective", "grammar"],
  "travel and places": ["preposition", "vocabulary", "tense", "modal"],
  technology: ["passive", "vocabulary", "grammar", "sentence structure"],
  "nature and environment": ["passive", "vocabulary", "grammar", "complex sentence"],
  "health and lifestyle": ["modal", "vocabulary", "comparative", "grammar"],
  "work and career": ["conditionals", "modal", "vocabulary", "grammar", "tense"],
  education: ["grammar", "vocabulary", "sentence structure", "modal"],
  "culture and society": ["passive", "grammar", "vocabulary", "complex sentence"],
  "opinions and debates": ["conditionals", "modal", "grammar", "vocabulary", "sentence structure"],
};

/**
 * Score a single topic against a weakness profile.
 *
 * For each weakness, checks whether its category string contains any of the
 * topic's affinity keywords (case-insensitive substring match). Matching
 * weaknesses contribute their score to the total.
 *
 * @param topic      - The topic string to score.
 * @param weaknesses - Weakness records (only `category` and `score` are used).
 * @param affinities - Map from topic → affinity keyword list.
 */
export function topicWeaknessScore(
  topic: string,
  weaknesses: Pick<Weakness, "category" | "score">[],
  affinities: Partial<Record<string, string[]>>,
): number {
  const keywords = affinities[topic];
  if (!keywords || keywords.length === 0) return 0;

  let total = 0;
  for (const { category, score } of weaknesses) {
    const cat = category.toLowerCase();
    if (keywords.some((kw) => cat.includes(kw.toLowerCase()))) {
      total += score;
    }
  }
  return total;
}

/**
 * Sort topics by weakness relevance — highest weakness score first.
 *
 * Topics that exercise categories the learner is currently weak in are ranked
 * first; topics with no matching weaknesses score 0 and keep their original
 * relative order (stable sort).
 *
 * @param topics     - Candidate topics in their default order.
 * @param weaknesses - Current weakness profile (all skills/CEFR levels).
 * @param affinities - Map from topic → affinity keyword list.
 * @returns A new array ranked from most to least relevant weakness coverage.
 */
export function rankTopicsByWeakness<T extends string>(
  topics: readonly T[],
  weaknesses: Pick<Weakness, "category" | "score">[],
  affinities: Partial<Record<string, string[]>>,
): T[] {
  const scored = topics.map((t, i) => ({
    topic: t,
    score: topicWeaknessScore(t, weaknesses, affinities),
    index: i,
  }));
  // Stable descending sort: when scores tie, original index order is preserved.
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((s) => s.topic);
}
