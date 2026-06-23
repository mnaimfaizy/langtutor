import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LangTutorDB } from "@/lib/db/database";
import { DexieContentRepository } from "@/lib/db/dexie-content-repository";
import type { CefrData, WordnetData } from "@/lib/lexicon";
import { LocalLexiconProvider } from "@/lib/lexicon/local-lexicon-provider";

// ── fixtures ─────────────────────────────────────────────────────────────────

const WN_FIXTURE: WordnetData = {
  hatchback: [
    {
      p: "n",
      d: "a car that has a hatchback door",
      e: [],
      s: [],
      up: ["car", "auto", "automobile"],
      dn: [],
    },
  ],
  fine: [
    { p: "n", d: "money extracted as a penalty", e: [], s: ["mulct"], up: ["penalty"], dn: [] },
    { p: "a", d: "of superior grade", e: ["fine wine"], s: [], up: [], dn: [] },
  ],
  dog: [
    {
      p: "n",
      d: "a domestic animal",
      e: ["the dog barked"],
      s: ["domestic dog"],
      up: ["canine"],
      dn: ["poodle"],
    },
  ],
};

const CEFR_FIXTURE: CefrData = {
  house: "A1",
  subsequently: "B2",
  exacerbate: "C1",
};

// ── test lifecycle ────────────────────────────────────────────────────────────

let dbCounter = 0;
let db: LangTutorDB;
let repo: DexieContentRepository;
let provider: LocalLexiconProvider;

beforeEach(() => {
  db = new LangTutorDB(`lexicon-provider-test-${dbCounter++}`);
  repo = new DexieContentRepository(db);
  provider = new LocalLexiconProvider(WN_FIXTURE, CEFR_FIXTURE, repo);
});

afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
});

// ── define() ─────────────────────────────────────────────────────────────────

describe("define()", () => {
  it("returns senses from bundled WordNet data", async () => {
    const senses = await provider.define("fine");
    expect(senses.length).toBe(2);
    expect(senses[0].definition).toBe("money extracted as a penalty");
  });

  it("is case-insensitive", async () => {
    expect(await provider.define("FINE")).toHaveLength(2);
    expect(await provider.define("Dog")).toHaveLength(1);
  });

  it("returns [] for unknown word", async () => {
    expect(await provider.define("xyzzy_unknown")).toEqual([]);
  });
});

// ── relations() ──────────────────────────────────────────────────────────────

describe("relations()", () => {
  it('hypernyms of "hatchback" include "car"', async () => {
    const r = await provider.relations("hatchback");
    expect(r.hypernyms).toContain("car");
  });

  it("returns empty relations for unknown word", async () => {
    const r = await provider.relations("xyzzy_unknown");
    expect(r.hypernyms).toEqual([]);
    expect(r.synonyms).toEqual([]);
    expect(r.hyponyms).toEqual([]);
  });
});

// ── cefrLevel() ──────────────────────────────────────────────────────────────

describe("cefrLevel()", () => {
  it("returns the CEFR level for a known word", async () => {
    expect(await provider.cefrLevel("house")).toBe("A1");
    expect(await provider.cefrLevel("subsequently")).toBe("B2");
  });

  it("returns null for an unknown word", async () => {
    expect(await provider.cefrLevel("xyzzy_unknown")).toBeNull();
  });
});

// ── audio() ──────────────────────────────────────────────────────────────────

describe("audio()", () => {
  const AUDIO_URL = "https://api.dictionaryapi.dev/media/pronunciations/en/hello-us.mp3";

  function mockFetchOk(audioUrl: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ phonetics: [{ audio: audioUrl }] }],
      }),
    );
  }

  function mockFetchNotFound() {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => [] }));
  }

  function mockFetchThrows() {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
  }

  it("fetches audio from Free Dictionary API on cache miss and returns URL", async () => {
    mockFetchOk(AUDIO_URL);
    const url = await provider.audio("hello");
    expect(url).toBe(AUDIO_URL);
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(`https://api.dictionaryapi.dev/api/v2/entries/en/hello`);
  });

  it("returns cached URL on second call without re-fetching", async () => {
    mockFetchOk(AUDIO_URL);
    await provider.audio("hello"); // populates cache
    vi.restoreAllMocks(); // clear fetch mock — any subsequent call would fail

    const url = await provider.audio("hello");
    expect(url).toBe(AUDIO_URL);
  });

  it("caches null when API returns no audio and avoids re-probing", async () => {
    mockFetchNotFound();
    const first = await provider.audio("unknownword");
    expect(first).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();

    vi.restoreAllMocks();
    const second = await provider.audio("unknownword");
    expect(second).toBeNull(); // served from null-cache, no new fetch
  });

  it("returns null and caches null when network is unavailable", async () => {
    mockFetchThrows();
    const url = await provider.audio("hello");
    expect(url).toBeNull();

    // Null is cached — restoring mocks and re-calling must return null without fetch
    vi.restoreAllMocks();
    expect(await provider.audio("hello")).toBeNull();
  });

  it("normalises the word to lowercase for the API call", async () => {
    mockFetchOk(AUDIO_URL);
    await provider.audio("Hello");
    expect(fetch).toHaveBeenCalledWith(`https://api.dictionaryapi.dev/api/v2/entries/en/hello`);
  });
});
