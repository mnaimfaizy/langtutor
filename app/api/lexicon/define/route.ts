import { getLexiconProvider } from "@/lib/lexicon/server";

export const dynamic = "force-dynamic";

interface FreeDictEntry {
  phonetic?: string;
  phonetics: Array<{ text?: string; audio?: string }>;
}

const FREE_DICT = "https://api.dictionaryapi.dev/api/v2/entries/en/";

async function fetchPhoneticAndAudio(
  word: string,
): Promise<{ phonetic: string | null; audioUrl: string | null }> {
  try {
    const res = await fetch(`${FREE_DICT}${encodeURIComponent(word)}`);
    if (!res.ok) return { phonetic: null, audioUrl: null };
    const entries = (await res.json()) as FreeDictEntry[];
    const entry = entries[0];
    if (!entry) return { phonetic: null, audioUrl: null };
    const phonetic = entry.phonetic ?? entry.phonetics.find((p) => p.text)?.text ?? null;
    const audioUrl = entry.phonetics.find((p) => p.audio)?.audio ?? null;
    return { phonetic, audioUrl };
  } catch {
    return { phonetic: null, audioUrl: null };
  }
}

/**
 * GET /api/lexicon/define?word=<word>
 *
 * Returns full definition data for tap-to-define in the passage reader.
 * Includes WordNet definition/examples/POS, CEFR level, IPA phonetic, and
 * audio URL from the Free Dictionary API.
 *
 * 200 `{ found: true, word, definition, examples, cefr, pos, phonetic, audioUrl }`
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
    const [senses, cefr, { phonetic, audioUrl }] = await Promise.all([
      lexicon.define(word),
      lexicon.cefrLevel(word),
      fetchPhoneticAndAudio(word),
    ]);

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
      phonetic,
      audioUrl,
    });
  } catch (error) {
    console.error("[api/lexicon/define]", error);
    return Response.json({ error: "Lexicon unavailable" }, { status: 503 });
  }
}
