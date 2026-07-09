/**
 * Browser helper for fetching a single embedding via same-origin API.
 * Best-effort by design: failures return undefined so feature flows keep working.
 *
 * Bounded with a short timeout so an unreachable Mac cannot hold a browser connection
 * open indefinitely — hung embedding fetches otherwise starve other same-origin calls
 * (e.g. getDueCards during an embedded unit review) via the per-host connection pool.
 */
export const EMBEDDING_FETCH_TIMEOUT_MS = 8_000;

export async function fetchSingleEmbedding(
  text: string,
  timeoutMs: number = EMBEDDING_FETCH_TIMEOUT_MS,
): Promise<number[] | undefined> {
  const input = text.trim();
  if (!input) return undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("/api/llm/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [input] }),
      signal: controller.signal,
    });

    if (!res.ok) return undefined;

    const data = (await res.json()) as { embeddings?: unknown };
    if (!Array.isArray(data.embeddings) || data.embeddings.length === 0) return undefined;

    const first = data.embeddings[0];
    if (!Array.isArray(first) || !first.every((v) => typeof v === "number")) return undefined;

    return first;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
