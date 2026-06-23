import { describe, expect, it } from "vitest";

import type { CefrData } from "@/lib/lexicon";
import { cefrLevel } from "@/lib/lexicon";

// Fixture: representative CEFR mapping verified against the generated
// data/words-cefr.json (frequency-rank model + WN supplement).
// A1/A2/B1 words verified by running scripts/build-words-cefr.mjs.
const FIXTURE: CefrData = {
  // A1 — top-1500 frequency band
  house: "A1",
  school: "A1",
  water: "A1",
  // A2 — rank 1501–3500
  respond: "A2",
  estimate: "A2",
  establish: "A2",
  // B1 — rank 3501–6000
  demonstrate: "B1",
  typical: "B1",
  fundamental: "B1",
  // B2 — rank 6001–8500
  subsequently: "B2",
  consequently: "B2",
  // C1 — rank 8501–10000 or WN tagsense ≥ 1
  exacerbate: "C1",
  paramount: "C1",
  // C2 — WN tagsense = 0
  perspicacious: "C2",
  recondite: "C2",
};

// ── cefrLevel() ──────────────────────────────────────────────────────────────

describe("cefrLevel()", () => {
  it("returns A1 for a known A1 word", () => {
    expect(cefrLevel("house", FIXTURE)).toBe("A1");
  });

  it("returns B2 for a known B2 word", () => {
    expect(cefrLevel("subsequently", FIXTURE)).toBe("B2");
  });

  it("returns null for an unknown word", () => {
    expect(cefrLevel("xyzzy_not_a_word", FIXTURE)).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(cefrLevel("HOUSE", FIXTURE)).toBe("A1");
    expect(cefrLevel("Subsequently", FIXTURE)).toBe("B2");
  });

  it("covers the full A1–C2 range in the fixture", () => {
    expect(cefrLevel("school", FIXTURE)).toBe("A1");
    expect(cefrLevel("respond", FIXTURE)).toBe("A2");
    expect(cefrLevel("demonstrate", FIXTURE)).toBe("B1");
    expect(cefrLevel("subsequently", FIXTURE)).toBe("B2");
    expect(cefrLevel("exacerbate", FIXTURE)).toBe("C1");
    expect(cefrLevel("perspicacious", FIXTURE)).toBe("C2");
  });

  it("ignores the optional pos parameter (POS-agnostic dataset)", () => {
    expect(cefrLevel("house", FIXTURE, "n")).toBe("A1");
    expect(cefrLevel("house", FIXTURE, "v")).toBe("A1");
  });
});
