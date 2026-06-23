import { getLexiconProvider } from "@/lib/lexicon/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/lexicon/lookup?word=<word>
 *
 * Returns the first WordNet sense + CEFR level for a word.
 * Used by the add-to-deck UI to populate card fields from the local lexicon.
 *
 * 200 `{ found: true, word, definition, examples, cefr, pos }` — word found
 * 200 `{ found: false, word }` — word not in WordNet
 * 400 — missing word param
 * 503 — lexicon data files not built yet
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("word")?.trim();
  if (!raw) return Response.json({ error: "word is required" }, { status: 400 });

  const word = raw.toLowerCase();

  try {
    const lexicon = getLexiconProvider();
    const [senses, cefr] = await Promise.all([lexicon.define(word), lexicon.cefrLevel(word)]);

    if (senses.length === 0) {
      return Response.json({ found: false, word });
    }

    const first = senses[0]!;
    return Response.json({
      found: true,
      word,
      definition: first.definition,
      examples: first.examples.slice(0, 2),
      cefr,
      pos: first.pos,
    });
  } catch (error) {
    console.error("[api/lexicon/lookup]", error);
    return Response.json({ error: "Lexicon unavailable" }, { status: 503 });
  }
}
