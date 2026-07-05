/**
 * Embedding utilities for semantic search (PLAN §1.6).
 * Pure similarity helpers are side-effect-free; routing helpers map provider
 * selection to the correct endpoint without persisting secrets.
 */

import type { EmbeddingsProvider } from "@/lib/db/drizzle/schema.shared";

/** Mistral OpenAI-compatible embeddings endpoint. */
export const MISTRAL_EMBEDDINGS_BASE_URL = "https://api.mistral.ai/v1";

/** Default Mistral embedding model when none is configured in appConfig. */
export const DEFAULT_MISTRAL_EMBED_MODEL = "mistral-embed";

// ── types ─────────────────────────────────────────────────────────────────────

/** Resolved endpoint + model for an embedding request (no secrets stored in DB). */
export interface EmbeddingRoute {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface EmbeddingRouteInput {
  embeddingsProvider: EmbeddingsProvider;
  model: string;
  macBaseUrl: string;
  macApiKey: string;
  mistralApiKey?: string;
}

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

// ── provider routing ──────────────────────────────────────────────────────────

/**
 * Map embeddings provider selection to the OpenAI-compatible endpoint and model.
 * Mistral uses `api.mistral.ai/v1` with the server env token; Mac uses the Ollama URL.
 */
export function resolveEmbeddingRoute(input: EmbeddingRouteInput): EmbeddingRoute {
  if (input.embeddingsProvider === "mistral") {
    const apiKey = input.mistralApiKey?.trim();
    if (!apiKey) {
      throw new Error("MISTRAL_API_KEY is required when embeddingsProvider is mistral");
    }
    return {
      baseURL: MISTRAL_EMBEDDINGS_BASE_URL,
      apiKey,
      model: input.model.trim() || DEFAULT_MISTRAL_EMBED_MODEL,
    };
  }

  return {
    baseURL: input.macBaseUrl,
    apiKey: input.macApiKey,
    model: input.model,
  };
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
