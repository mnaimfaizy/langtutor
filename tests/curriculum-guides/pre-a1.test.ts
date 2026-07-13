import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  formatGuideSectionsForPrompt,
  listPreA1GuideSectionKeys,
  loadPreA1CurriculumGuide,
  loadPreA1SourcesDocument,
  retrieveRelevantSections,
} from "@/lib/curriculum-guides";

describe("pre-A1 curriculum guide assets", () => {
  it("loads spine, phonics distillation, excerpts, and SOURCES", () => {
    const guide = loadPreA1CurriculumGuide();

    expect(guide.spine.id).toBe("pre-a1-spine");
    expect(guide.phonics.id).toBe("pre-a1-phonics");
    expect(guide.excerpts.id).toBe("pre-a1-excerpts");
    expect(guide.spine.sections.length).toBeGreaterThan(0);
    expect(guide.phonics.sections.length).toBeGreaterThan(0);
    expect(guide.excerpts.sections.length).toBeGreaterThan(0);

    const sources = loadPreA1SourcesDocument();
    expect(sources).toMatch(/Letters and Sounds/i);
    expect(sources).toMatch(/Open Government Licence|Crown copyright/i);
    expect(sources).toMatch(/Cambridge Pre A1 Starters/i);
    expect(sources).toMatch(/do not bundle|Never commit full commercial/i);

    const onDisk = readFileSync(
      join(process.cwd(), "data/curriculum-guides/pre-a1/SOURCES.md"),
      "utf8",
    );
    expect(onDisk).toBe(sources);
  });

  it("does not ship full commercial wordlists in excerpts", () => {
    const guide = loadPreA1CurriculumGuide();
    const allBodies = [
      ...guide.spine.sections,
      ...guide.phonics.sections,
      ...guide.excerpts.sections,
    ]
      .map((s) => s.body)
      .join("\n");

    expect(allBodies.toLowerCase()).toContain("do not redistribute");
    for (const section of guide.excerpts.sections) {
      expect(section.body.toLowerCase()).toContain("paraphrase");
      expect(section.body.length).toBeLessThan(900);
    }
  });
});

describe("retrieveRelevantSections", () => {
  it("returns only requested sections in request order", () => {
    const keys = [
      "spine.stages.alphabet",
      "phonics.phase.early-gpcs",
      "excerpts.starters.intent",
    ] as const;

    const sections = retrieveRelevantSections(keys);

    expect(sections.map((s) => s.key)).toEqual([...keys]);
    expect(sections[0]?.title).toMatch(/Alphabet/i);
    expect(sections[1]?.body).toMatch(/GPC/i);
    expect(sections[2]?.body).toMatch(/Starters/i);

    const prompt = formatGuideSectionsForPrompt(sections);
    expect(prompt).toContain("### ");
    expect(prompt).toContain(sections[0]!.body);
    // Must not dump the entire spine when only slices were requested.
    expect(prompt).not.toContain(
      loadPreA1CurriculumGuide().spine.sections.find((s) => s.key === "spine.overview")!.body,
    );
  });

  it("fails safely on missing keys (omits unknowns, no throw)", () => {
    const sections = retrieveRelevantSections([
      "spine.overview",
      "does.not.exist",
      "phonics.out-of-scope",
      "also.missing",
    ]);

    expect(sections.map((s) => s.key)).toEqual(["spine.overview", "phonics.out-of-scope"]);
    expect(() => retrieveRelevantSections(["totally.unknown"])).not.toThrow();
    expect(retrieveRelevantSections(["totally.unknown"])).toEqual([]);
  });

  it("lists stable section keys covering spine, phonics, and excerpts", () => {
    const keys = listPreA1GuideSectionKeys();
    expect(keys).toContain("spine.overview");
    expect(keys).toContain("phonics.ladder.overview");
    expect(keys).toContain("excerpts.cefr.pre-a1");
    expect(new Set(keys).size).toBe(keys.length);
  });
});
