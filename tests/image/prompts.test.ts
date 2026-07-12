import { describe, expect, it } from "vitest";

import { buildKidIllustrationPrompt, resolveKidIllustrationPrompt } from "@/lib/image/prompts";

describe("buildKidIllustrationPrompt", () => {
  it("names the subject without wrapping it in quotes (FLUX renders quotes as text)", () => {
    const prompt = buildKidIllustrationPrompt("Apple");
    expect(prompt).toContain("a single apple");
    expect(prompt).not.toMatch(/"apple"/i);
    expect(prompt).not.toMatch(/'apple'/i);
  });

  it("asks for a large close-up subject that fills the frame", () => {
    const prompt = buildKidIllustrationPrompt("apple");
    expect(prompt.toLowerCase()).toContain("fills most of the frame");
    expect(prompt.toLowerCase()).toContain("close-up");
  });

  it("asks for a purely pictorial unlabeled result", () => {
    const prompt = buildKidIllustrationPrompt("ball");
    expect(prompt.toLowerCase()).toContain("purely pictorial");
    expect(prompt.toLowerCase()).toContain("no letters");
  });
});

describe("resolveKidIllustrationPrompt", () => {
  it("prefers a non-empty override over the default template", () => {
    expect(resolveKidIllustrationPrompt("apple", "  custom prompt  ")).toBe("custom prompt");
  });

  it("falls back to the kid template when override is empty", () => {
    expect(resolveKidIllustrationPrompt("apple", "   ")).toBe(buildKidIllustrationPrompt("apple"));
  });
});
