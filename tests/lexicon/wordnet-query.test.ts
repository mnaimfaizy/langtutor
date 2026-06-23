import { describe, expect, it } from "vitest";

import type { WordnetData } from "@/lib/lexicon";
import { define, relations } from "@/lib/lexicon";

// Real WordNet 3.1 data for the two Accept-criteria words plus helpers.
// Hypernym/hyponym chains are taken directly from WN3.1 synset pointers.
const FIXTURE: WordnetData = {
  hatchback: [
    {
      p: "n",
      d: "a car that has a hatchback door",
      e: [],
      s: [],
      up: ["car", "auto", "automobile", "machine", "motorcar"],
      dn: [],
    },
  ],
  car: [
    {
      p: "n",
      d: "a motor vehicle with four wheels; usually propelled by an internal combustion engine",
      e: ["he needs a car to get to work"],
      s: ["auto", "automobile", "machine", "motorcar"],
      up: ["motor vehicle", "automotive vehicle"],
      dn: [
        "hatchback",
        "compact",
        "compact car",
        "convertible",
        "coupe",
        "sedan",
        "sport utility",
        "sport utility vehicle",
        "stock car",
        "subcompact",
        "subcompact car",
        "touring car",
        "phaeton",
        "tourer",
      ],
    },
  ],
  fine: [
    {
      p: "n",
      d: "money extracted as a penalty",
      e: ["you will have to pay a fine for that"],
      s: ["mulct", "amercement"],
      up: ["penalty", "punishment", "penalization", "penalisation"],
      dn: ["parking ticket"],
    },
    {
      p: "v",
      d: "issue a ticket or a fine to as a penalty",
      e: ["he was fined for speeding"],
      s: ["ticket"],
      up: [],
      dn: [],
    },
    {
      p: "a",
      d: "being in good health",
      e: ["I feel fine"],
      s: ["all right", "okay", "ok"],
      up: [],
      dn: [],
    },
    {
      p: "a",
      d: "of superior grade",
      e: ["fine wine", "a fine restaurant"],
      s: [],
      up: [],
      dn: [],
    },
  ],
  dog: [
    {
      p: "n",
      d: "a domesticated carnivore renowned as man's best friend",
      e: ["the dog barked all night"],
      s: ["domestic dog", "Canis familiaris"],
      up: ["canine", "canid"],
      dn: ["poodle", "spitz", "bulldog", "dalmatian", "corgi", "basenji"],
    },
  ],
};

// ── define() ────────────────────────────────────────────────────────────────

describe("define()", () => {
  it("returns multiple senses for fine", () => {
    expect(define("fine", FIXTURE).length).toBeGreaterThan(1);
  });

  it("returns [] for an unknown word", () => {
    expect(define("xyzzy_not_a_real_word", FIXTURE)).toEqual([]);
  });

  it("each sense has the required fields", () => {
    for (const sense of define("dog", FIXTURE)) {
      expect(sense).toMatchObject({
        pos: expect.stringMatching(/^[nvar]$/),
        definition: expect.any(String),
        examples: expect.any(Array),
        synonyms: expect.any(Array),
        hypernyms: expect.any(Array),
        hyponyms: expect.any(Array),
      });
    }
  });

  it("is case-insensitive", () => {
    expect(define("FINE", FIXTURE).length).toBeGreaterThan(0);
    expect(define("Fine", FIXTURE).length).toBeGreaterThan(0);
  });
});

// ── relations() ─────────────────────────────────────────────────────────────

describe("relations()", () => {
  it('hypernyms of "hatchback" include "car"', () => {
    expect(relations("hatchback", FIXTURE).hypernyms).toContain("car");
  });

  it('hyponyms of "car" include "hatchback"', () => {
    expect(relations("car", FIXTURE).hyponyms).toContain("hatchback");
  });

  it('synonyms of "dog" are non-empty', () => {
    expect(relations("dog", FIXTURE).synonyms.length).toBeGreaterThan(0);
  });

  it("returns empty relations for an unknown word", () => {
    const r = relations("xyzzy_not_a_real_word", FIXTURE);
    expect(r.hypernyms).toEqual([]);
    expect(r.hyponyms).toEqual([]);
    expect(r.synonyms).toEqual([]);
  });

  it("deduplicates entries that appear in multiple senses", () => {
    const r = relations("fine", FIXTURE);
    const uniqueSyn = new Set(r.synonyms);
    expect(r.synonyms.length).toBe(uniqueSyn.size);
    const uniqueHyp = new Set(r.hypernyms);
    expect(r.hypernyms.length).toBe(uniqueHyp.size);
  });
});
