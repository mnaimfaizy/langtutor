/**
 * Bundled pre-A1 curriculum guide corpus (ADR 0041 / 0047, issue #124).
 *
 * Assets live under `data/curriculum-guides/pre-a1/`. Load + retrieve helpers ground
 * teacher/admin prompts with spine slices — never full commercial handbooks or live
 * web search. No learner UI in this module.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import excerptsRaw from "@/data/curriculum-guides/pre-a1/excerpts.json";
import phonicsRaw from "@/data/curriculum-guides/pre-a1/phonics.json";
import spineRaw from "@/data/curriculum-guides/pre-a1/spine.json";

const GuideSectionSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
});

const GuideDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  version: z.literal(1),
  attribution: z.string().min(1).optional(),
  sections: z.array(GuideSectionSchema).min(1),
});

export type CurriculumGuideSection = z.infer<typeof GuideSectionSchema>;
export type CurriculumGuideDocument = z.infer<typeof GuideDocumentSchema>;

export type PreA1CurriculumGuide = {
  spine: CurriculumGuideDocument;
  phonics: CurriculumGuideDocument;
  excerpts: CurriculumGuideDocument;
  /** Absolute path to the licence matrix markdown (audit trail). */
  sourcesPath: string;
};

const PRE_A1_DIR = join(process.cwd(), "data/curriculum-guides/pre-a1");
const SOURCES_PATH = join(PRE_A1_DIR, "SOURCES.md");

let _guide: PreA1CurriculumGuide | null = null;
let _sectionIndex: Map<string, CurriculumGuideSection> | null = null;

function parseDocument(raw: unknown, label: string): CurriculumGuideDocument {
  const parsed = GuideDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid curriculum guide document (${label}): ${parsed.error.message}`);
  }
  return parsed.data;
}

function buildSectionIndex(guide: PreA1CurriculumGuide): Map<string, CurriculumGuideSection> {
  const index = new Map<string, CurriculumGuideSection>();
  for (const doc of [guide.spine, guide.phonics, guide.excerpts]) {
    for (const section of doc.sections) {
      if (index.has(section.key)) {
        throw new Error(`Duplicate curriculum guide section key: ${section.key}`);
      }
      index.set(section.key, section);
    }
  }
  return index;
}

/** Load and Zod-parse the bundled pre-A1 guide corpus (cached). */
export function loadPreA1CurriculumGuide(): PreA1CurriculumGuide {
  if (_guide) return _guide;

  const guide: PreA1CurriculumGuide = {
    spine: parseDocument(spineRaw, "spine"),
    phonics: parseDocument(phonicsRaw, "phonics"),
    excerpts: parseDocument(excerptsRaw, "excerpts"),
    sourcesPath: SOURCES_PATH,
  };

  // Fail fast if SOURCES.md is missing from the worktree.
  readFileSync(SOURCES_PATH, "utf8");

  _guide = guide;
  _sectionIndex = buildSectionIndex(guide);
  return guide;
}

/** Read the licence matrix markdown next to the guide assets. */
export function loadPreA1SourcesDocument(): string {
  loadPreA1CurriculumGuide();
  return readFileSync(SOURCES_PATH, "utf8");
}

/**
 * Return only the requested guide sections, in request order.
 *
 * Unknown keys are omitted (safe miss) — callers must not assume every key exists.
 * Never expands into full commercial corpora; only bundled section bodies are returned.
 */
export function retrieveRelevantSections(
  keys: readonly string[],
  guide: PreA1CurriculumGuide = loadPreA1CurriculumGuide(),
): CurriculumGuideSection[] {
  // Prefer the cached index when using the bundled singleton; rebuild for injected fixtures.
  const index =
    guide === _guide && _sectionIndex !== null ? _sectionIndex : buildSectionIndex(guide);

  const out: CurriculumGuideSection[] = [];
  for (const key of keys) {
    const section = index.get(key);
    if (section) out.push(section);
  }
  return out;
}

/** Stable list of all section keys (for tests / admin tooling). */
export function listPreA1GuideSectionKeys(
  guide: PreA1CurriculumGuide = loadPreA1CurriculumGuide(),
): string[] {
  return [...guide.spine.sections, ...guide.phonics.sections, ...guide.excerpts.sections].map(
    (s) => s.key,
  );
}

/** Format retrieved sections as prompt grounding text. */
export function formatGuideSectionsForPrompt(sections: readonly CurriculumGuideSection[]): string {
  if (sections.length === 0) return "";
  return sections.map((s) => `### ${s.title}\n${s.body}`).join("\n\n");
}
