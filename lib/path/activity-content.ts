/**
 * Generate-and-cache helpers for a unit's activity content (issue #59, extended by #60 and
 * #61). Extracted from `app/path/[id]/unit-view.tsx` so the path-buffer replenishment pass
 * (`lib/path/replenish.ts`) can pre-generate the same content ahead of time, not just
 * lazily on first open — one code path for both callers.
 *
 * Client-side only: these call the same-origin generation routes (`/api/reading/generate`,
 * `/api/writing/generate`) that are the sole callers of the Mac for this content (hard rule
 * 1), then cache the Zod-validated result via `ContentRepository.putContent`.
 */
import type { ActivityKind, Cefr, ContentRepository, NewContent, Unit } from "@/lib/db";
import { fetchSingleEmbedding } from "@/lib/content/client-embeddings";
import { lookupConstruction } from "@/lib/content/grammar-map";
import { PassageSchema } from "@/lib/content/passage";
import { PromptSchema } from "@/lib/content/prompt";

/** Topic for a unit's generated activity content: its grammar focus, or its title. */
export function unitTopicFor(unit: Unit): string {
  const construction = lookupConstruction(unit.targetGrammarIds[0] ?? "");
  return construction?.label ?? unit.title;
}

/** Activity kinds whose content is a `passage` — reading, listening, and speaking all read/
 * hear/say the same generated text, generated via the same reading pipeline (issue #60). */
export const PASSAGE_ACTIVITY_KINDS: ReadonlySet<ActivityKind> = new Set([
  "reading",
  "listening",
  "speaking",
]);

/** Generates and caches passage content for a reading/listening/speaking slot. */
export async function generatePassageContent(
  repo: ContentRepository,
  topic: string,
  level: Cefr,
): Promise<number> {
  const res = await fetch("/api/reading/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, level }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as { passage: unknown };
  const passage = PassageSchema.parse(data.passage);
  const embedding = await fetchSingleEmbedding(passage.body);

  return repo.putContent({
    type: "passage",
    level,
    topic,
    payload: passage,
    source: "generated",
    validatedAt: new Date(),
    embedding,
  } satisfies NewContent);
}

/** Generates and caches writing-prompt content for a writing slot. */
export async function generatePromptContent(
  repo: ContentRepository,
  topic: string,
  level: Cefr,
): Promise<number> {
  const res = await fetch("/api/writing/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, level }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as { prompt: unknown };
  const prompt = PromptSchema.parse(data.prompt);
  const embedding = await fetchSingleEmbedding(prompt.instruction);

  return repo.putContent({
    type: "prompt",
    level,
    topic,
    payload: prompt,
    source: "generated",
    validatedAt: new Date(),
    embedding,
  } satisfies NewContent);
}

/**
 * Generates and caches @unit's content for one activity slot of kind @skill, dispatching to
 * the passage or prompt pipeline. Throws on failure (unreachable provider, invalid response) —
 * callers decide how to handle that (inline retry in the unit view, silent skip in the
 * replenishment pass).
 */
export async function generateActivityContent(
  repo: ContentRepository,
  unit: Unit,
  skill: ActivityKind,
): Promise<number> {
  const topic = unitTopicFor(unit);
  return PASSAGE_ACTIVITY_KINDS.has(skill)
    ? generatePassageContent(repo, topic, unit.targetCefr)
    : generatePromptContent(repo, topic, unit.targetCefr);
}
