/**
 * Browser helper for fetching a single embedding via same-origin API.
 * Best-effort by design: failures return undefined so feature flows keep working.
 */
export async function fetchSingleEmbedding(text: string): Promise<number[] | undefined> {
  const input = text.trim();
  if (!input) return undefined;

  try {
    const res = await fetch("/api/llm/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: [input] }),
    });

    if (!res.ok) return undefined;

    const data = (await res.json()) as { embeddings?: unknown };
    if (!Array.isArray(data.embeddings) || data.embeddings.length === 0) return undefined;

    const first = data.embeddings[0];
    if (!Array.isArray(first) || !first.every((v) => typeof v === "number")) return undefined;

    return first;
  } catch {
    return undefined;
  }
}
