import { describe, expect, it } from "vitest";

import {
  formatExamplesText,
  parseExamplesText,
  validateCardDefinition,
} from "@/lib/deck/edit-card";

describe("validateCardDefinition", () => {
  it("accepts a non-empty trimmed definition", () => {
    expect(validateCardDefinition("  emitting light  ")).toEqual({
      ok: true,
      definition: "emitting light",
    });
  });

  it("rejects an empty definition", () => {
    expect(validateCardDefinition("   ")).toEqual({
      ok: false,
      message: "Definition cannot be empty.",
    });
  });
});

describe("parseExamplesText", () => {
  it("splits on newlines and drops blank lines", () => {
    expect(parseExamplesText("First line.\n\n  Second line.  \n")).toEqual([
      "First line.",
      "Second line.",
    ]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseExamplesText("  \n  ")).toEqual([]);
  });
});

describe("formatExamplesText", () => {
  it("joins examples with newlines", () => {
    expect(formatExamplesText(["One.", "Two."])).toBe("One.\nTwo.");
  });
});
