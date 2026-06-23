import { z } from "zod";

import type {
  Card,
  Cefr,
  Content,
  ErrorEventRecord,
  GamificationState,
  LexiconCacheEntry,
  NewCard,
  NewContent,
  NewErrorEvent,
  Profile,
  ProfileSettings,
  Weakness,
} from "@/lib/db";
import type { ContentQuery, ContentRepository, ErrorEventQuery } from "@/lib/db";
import { LocalContentValidator } from "@/lib/content/content-validator";
import { buildPassageMessages, PassageSchema } from "@/lib/content/passage";
import { generateContent } from "@/lib/content/pipeline";
import { loadCefrData } from "@/lib/lexicon/data-loader";
import { getLLMClient } from "@/lib/llm/server";
import { isSameOrigin } from "@/lib/server/origin";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  topic: z.string().min(1).max(200),
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"] as const satisfies readonly Cefr[]),
});

// The pipeline requires a ContentRepository to cache the result. On the server there is
// no Dexie (browser-only); the validated passage is returned to the client, which caches
// it in IndexedDB. Only putContent() is ever called by the pipeline.
class NullContentRepository implements ContentRepository {
  putContent(_c: NewContent): Promise<number> {
    return Promise.resolve(0);
  }
  getContent(_id: number): Promise<Content | undefined> {
    return Promise.resolve(undefined);
  }
  queryContent(_q?: ContentQuery): Promise<Content[]> {
    return Promise.resolve([]);
  }
  getProfile(): Promise<Profile | undefined> {
    return Promise.resolve(undefined);
  }
  saveProfile(_p: Profile): Promise<void> {
    return Promise.resolve();
  }
  getSettings(): Promise<ProfileSettings> {
    return Promise.resolve({});
  }
  saveSettings(_s: ProfileSettings): Promise<void> {
    return Promise.resolve();
  }
  addCard(_c: NewCard): Promise<number> {
    return Promise.resolve(0);
  }
  getCard(_id: number): Promise<Card | undefined> {
    return Promise.resolve(undefined);
  }
  getAllCards(): Promise<Card[]> {
    return Promise.resolve([]);
  }
  getDueCards(_now: Date): Promise<Card[]> {
    return Promise.resolve([]);
  }
  updateCard(_id: number, _changes: Partial<NewCard>): Promise<void> {
    return Promise.resolve();
  }
  deleteCard(_id: number): Promise<void> {
    return Promise.resolve();
  }
  addErrorEvent(_e: NewErrorEvent): Promise<number> {
    return Promise.resolve(0);
  }
  queryErrorEvents(_q?: ErrorEventQuery): Promise<ErrorEventRecord[]> {
    return Promise.resolve([]);
  }
  getWeaknesses(): Promise<Weakness[]> {
    return Promise.resolve([]);
  }
  putWeakness(_w: Weakness): Promise<void> {
    return Promise.resolve();
  }
  getGamification(): Promise<GamificationState | undefined> {
    return Promise.resolve(undefined);
  }
  saveGamification(_s: GamificationState): Promise<void> {
    return Promise.resolve();
  }
  getLexiconEntry(_word: string): Promise<LexiconCacheEntry | undefined> {
    return Promise.resolve(undefined);
  }
  putLexiconEntry(_e: LexiconCacheEntry): Promise<void> {
    return Promise.resolve();
  }
  clear(): Promise<void> {
    return Promise.resolve();
  }
}

// Module-level singleton — cefrData is loaded once from disk on first generation request.
let _validator: LocalContentValidator | undefined;

function getValidator(): LocalContentValidator {
  if (!_validator) {
    _validator = new LocalContentValidator(loadCefrData());
  }
  return _validator;
}

/**
 * `POST /api/reading/generate` — generate a CEFR-valid reading passage.
 * Body: `{ topic: string, level: Cefr }`
 * Response: `{ passage: { title: string, body: string } }`
 *
 * The passage is validated by the pipeline (word + grammar CEFR gate, corrective retries).
 * Caching to IndexedDB happens on the client after it receives the response.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { topic, level } = parsed.data;

  try {
    const llmClient = await getLLMClient();
    const validator = getValidator();
    const repo = new NullContentRepository();

    const result = await generateContent(
      {
        messages: buildPassageMessages(topic, level),
        level,
        schema: PassageSchema,
        textField: "body",
        type: "passage",
        topic,
      },
      llmClient,
      validator,
      repo,
    );

    return Response.json({ passage: result.parsed });
  } catch (error) {
    console.error("[api/reading/generate]", error);
    return Response.json({ error: "Failed to generate passage" }, { status: 502 });
  }
}
