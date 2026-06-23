/**
 * Embedding utilities for semantic search (PLAN §1.6).
 * All functions are pure and side-effect-free — testable with precomputed vectors.
 * Actual embedding generation goes through `LLMClient.embed()` (server-side).
 */

// ── types ─────────────────────────────────────────────────────────────────────

/** A candidate item paired with its embedding vector. */
export interface EmbeddedItem<T> {
  item: T;
  embedding: readonly number[];
}

/** An item from `findNearest` annotated with its cosine similarity score. */
export interface SimilarityResult<T> {
  item: T;
  /** Cosine similarity in [−1, 1]. Higher = more similar. */
  score: number;
}

// ── cosine similarity ─────────────────────────────────────────────────────────

/**
 * Cosine similarity between two equal-length vectors.
 *
 * Returns a value in [−1, 1]:
 *   1  → identical direction
 *   0  → orthogonal
 *  −1  → opposite direction
 *
 * Returns 0 (rather than NaN) when either vector has zero magnitude.
 * Throws when the vectors have different lengths.
 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── nearest-neighbour search ──────────────────────────────────────────────────

/**
 * Returns up to @topN items from @candidates whose embeddings are most similar
 * to @query, sorted by descending cosine similarity.
 *
 * Linear scan — suitable for the single-user content library scale this app
 * targets. Replace with an ANN index (e.g. HNSW) if the corpus grows large.
 */
export function findNearest<T>(
  query: readonly number[],
  candidates: EmbeddedItem<T>[],
  topN = 5,
): SimilarityResult<T>[] {
  return candidates
    .map((c) => ({ item: c.item, score: cosineSimilarity(query, c.embedding) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, topN);
}
