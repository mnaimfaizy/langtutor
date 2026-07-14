/**
 * Shared-path `targetVocab` persistence helpers.
 *
 * SQL stores a JSON text column. Legacy rows are a bare `string[]`. New drafts may
 * embed senses as `{ words, senses }` so we avoid a schema migration.
 */
export type SharedPathTargetVocabPayload = {
  words: string[];
  /** Kid-facing sense / image hint keyed by normalized lowercase word. */
  senses: Record<string, string>;
};

function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Flatten draft items into words + sense map (first occurrence wins). */
export function flattenTargetVocabItems(
  items: readonly { word: string; sense: string }[],
): SharedPathTargetVocabPayload {
  const words: string[] = [];
  const senses: Record<string, string> = {};
  const seen = new Set<string>();
  for (const item of items) {
    const word = normalizeWord(item.word);
    if (!word || seen.has(word)) continue;
    seen.add(word);
    words.push(word);
    const sense = item.sense.trim();
    if (sense) senses[word] = sense;
  }
  return { words, senses };
}

/** Decode the shared-path `target_vocab` JSON column (legacy array or enriched object). */
export function decodeSharedPathTargetVocab(raw: string): SharedPathTargetVocabPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { words: [], senses: {} };
  }

  if (Array.isArray(parsed)) {
    const words: string[] = [];
    const senses: Record<string, string> = {};
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (typeof entry === "string") {
        const word = normalizeWord(entry);
        if (!word || seen.has(word)) continue;
        seen.add(word);
        words.push(word);
        continue;
      }
      if (entry && typeof entry === "object" && "word" in entry) {
        const word = normalizeWord(String((entry as { word: unknown }).word));
        if (!word || seen.has(word)) continue;
        seen.add(word);
        words.push(word);
        const sense =
          "sense" in entry && typeof (entry as { sense: unknown }).sense === "string"
            ? (entry as { sense: string }).sense.trim()
            : "";
        if (sense) senses[word] = sense;
      }
    }
    return { words, senses };
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { words?: unknown }).words)) {
    const blob = parsed as { words: unknown[]; senses?: unknown };
    const words: string[] = [];
    const seen = new Set<string>();
    for (const entry of blob.words) {
      if (typeof entry !== "string") continue;
      const word = normalizeWord(entry);
      if (!word || seen.has(word)) continue;
      seen.add(word);
      words.push(word);
    }
    const senses: Record<string, string> = {};
    if (blob.senses && typeof blob.senses === "object" && !Array.isArray(blob.senses)) {
      for (const [key, value] of Object.entries(blob.senses as Record<string, unknown>)) {
        if (typeof value !== "string") continue;
        const word = normalizeWord(key);
        const sense = value.trim();
        if (word && sense) senses[word] = sense;
      }
    }
    return { words, senses };
  }

  return { words: [], senses: {} };
}

/** Encode for the shared-path `target_vocab` column (legacy array when no senses). */
export function encodeSharedPathTargetVocab(
  words: readonly string[],
  senses?: Record<string, string> | null,
): string {
  const normalizedWords: string[] = [];
  const seen = new Set<string>();
  for (const raw of words) {
    const word = normalizeWord(raw);
    if (!word || seen.has(word)) continue;
    seen.add(word);
    normalizedWords.push(word);
  }

  const cleaned: Record<string, string> = {};
  if (senses) {
    for (const [key, value] of Object.entries(senses)) {
      const word = normalizeWord(key);
      const sense = value.trim();
      if (word && sense && seen.has(word)) cleaned[word] = sense;
    }
  }

  if (Object.keys(cleaned).length === 0) {
    return JSON.stringify(normalizedWords);
  }
  return JSON.stringify({ words: normalizedWords, senses: cleaned });
}
