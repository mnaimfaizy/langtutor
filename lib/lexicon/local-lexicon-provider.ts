import type { Cefr, ContentRepository } from "@/lib/db";

import { cefrLevel as cefrLookup } from "./cefr-lookup";
import type { LexiconProvider } from "./lexicon-provider";
import type { CefrData, PartOfSpeech, WordRelations, WordSense } from "./types";
import { define as wnDefine, relations as wnRelations } from "./wordnet-query";
import type { WordnetData } from "./wordnet-query";

/** Shape stored in {@link ContentRepository.putLexiconEntry} `data` for audio entries. */
interface AudioCache {
  audioUrl: string | null;
}

/** Free Dictionary API response (partial). */
interface FreeDictEntry {
  phonetics: Array<{ audio?: string }>;
}

const FREE_DICT = "https://api.dictionaryapi.dev/api/v2/entries/en/";

/**
 * LexiconProvider implementation (PLAN §1.3).
 * Holds pre-loaded WordNet + CEFR data; construction is cheap once data is
 * in memory. Obtain the singleton via `lib/lexicon/server.ts` — never
 * construct this directly in feature code.
 *
 * @param repo - IndexedDB repository for audio-URL caching. Pass `null` in
 *   server (Node.js) contexts where IndexedDB is unavailable; audio() will
 *   still fetch from the Free Dictionary API but will not cache the result.
 */
export class LocalLexiconProvider implements LexiconProvider {
  constructor(
    private readonly wordnet: WordnetData,
    private readonly cefrData: CefrData,
    private readonly repo: ContentRepository | null,
  ) {}

  async define(word: string): Promise<WordSense[]> {
    return wnDefine(word, this.wordnet);
  }

  async relations(word: string): Promise<WordRelations> {
    return wnRelations(word, this.wordnet);
  }

  async cefrLevel(word: string, pos?: PartOfSpeech): Promise<Cefr | null> {
    return cefrLookup(word, this.cefrData, pos);
  }

  async audio(word: string): Promise<string | null> {
    const key = word.toLowerCase();

    // 1. Cache hit — only when a repo is available (null in Node.js/server context
    //    where IndexedDB is unavailable; audio still fetches, just isn't cached).
    if (this.repo) {
      const cached = await this.repo.getLexiconEntry(key);
      if (cached) {
        const payload = cached.data as AudioCache | null;
        return payload?.audioUrl ?? null;
      }
    }

    // 2. Fetch from Free Dictionary API
    let audioUrl: string | null = null;
    try {
      const res = await fetch(`${FREE_DICT}${encodeURIComponent(key)}`);
      if (res.ok) {
        const entries = (await res.json()) as FreeDictEntry[];
        audioUrl = entries[0]?.phonetics?.find((p) => Boolean(p.audio))?.audio ?? null;
      }
    } catch {
      // Network unavailable — fall through with null
    }

    // 3. Cache result (including null) to suppress repeat probes
    if (this.repo) {
      await this.repo.putLexiconEntry({
        word: key,
        data: { audioUrl } satisfies AudioCache,
        cachedAt: new Date(),
      });
    }

    return audioUrl;
  }
}
