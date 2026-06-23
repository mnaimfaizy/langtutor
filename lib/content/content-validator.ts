import type { Cefr } from "@/lib/db";
import type { CefrData } from "@/lib/lexicon";

import { GRAMMAR_MAP, type GrammarMap } from "./grammar-map";

// ── types ─────────────────────────────────────────────────────────────────────

export interface WordViolation {
  type: "word";
  /** The offending word (lowercase). */
  word: string;
  /** Actual CEFR level of the word. */
  wordLevel: Cefr;
  /** Target level the text was validated against. */
  targetLevel: Cefr;
}

export interface GrammarViolation {
  type: "grammar";
  /** Stable id from the grammar map (e.g. "second_conditional"). */
  constructionId: string;
  /** Human-readable label (e.g. "Second conditional (hypothetical present/future)"). */
  constructionLabel: string;
  /** CEFR level at which this construction is introduced. */
  constructionLevel: Cefr;
  /** Target level the text was validated against. */
  targetLevel: Cefr;
}

export type Violation = WordViolation | GrammarViolation;

export interface ValidationResult {
  /** True when no violations were found. */
  ok: boolean;
  violations: Violation[];
}

/**
 * ContentValidator seam interface (PLAN §2.3).
 * Feature code imports this; the concrete is wired in the pipeline (Phase 1.7).
 */
export interface ContentValidator {
  validate(text: string, targetCefr: Cefr): ValidationResult;
}

// ── CEFR ordering ─────────────────────────────────────────────────────────────

const CEFR_RANK: Record<Cefr, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

function isAbove(level: Cefr, target: Cefr): boolean {
  return CEFR_RANK[level] > CEFR_RANK[target];
}

// ── word violation detection ──────────────────────────────────────────────────

function wordViolations(text: string, targetCefr: Cefr, cefrData: CefrData): WordViolation[] {
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  const seen = new Set<string>();
  const violations: WordViolation[] = [];

  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    if (/^\d+$/.test(token)) continue; // numbers are not vocabulary items

    const level = cefrData[token];
    if (!level) continue; // unknown word — no judgement
    if (isAbove(level, targetCefr)) {
      violations.push({ type: "word", word: token, wordLevel: level, targetLevel: targetCefr });
    }
  }

  return violations;
}

// ── grammar violation detection ───────────────────────────────────────────────

/**
 * Compile a grammar map's markers into RegExp objects once.
 * Returns a parallel array aligned with the map — entries are `null` for
 * constructions whose markers all failed to compile (invalid regex).
 */
function compileMarkers(grammarMap: GrammarMap): Array<RegExp[]> {
  return grammarMap.map((c) =>
    c.markers.flatMap((m) => {
      try {
        return [new RegExp(m, "i")];
      } catch {
        return [];
      }
    }),
  );
}

function grammarViolations(
  text: string,
  targetCefr: Cefr,
  grammarMap: GrammarMap,
  compiledMarkers: Array<RegExp[]>,
): GrammarViolation[] {
  const violations: GrammarViolation[] = [];

  for (let i = 0; i < grammarMap.length; i++) {
    const construction = grammarMap[i];
    if (!isAbove(construction.cefr, targetCefr)) continue;

    const regexps = compiledMarkers[i];
    for (const re of regexps) {
      if (re.test(text)) {
        violations.push({
          type: "grammar",
          constructionId: construction.id,
          constructionLabel: construction.label,
          constructionLevel: construction.cefr,
          targetLevel: targetCefr,
        });
        break; // one violation per construction regardless of how many markers fire
      }
    }
  }

  return violations;
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Validates @text against @targetCefr.
 *
 * Checks:
 *  1. Word CEFR — each known word's level must not exceed @targetCefr.
 *  2. Grammar constructions — detected constructions must not exceed @targetCefr.
 *
 * Unknown words are silently skipped (no false positives for gaps in the dataset).
 * Accepts an optional @grammarMap so callers can inject a subset for testing;
 * defaults to the full committed {@link GRAMMAR_MAP}.
 */
export function validate(
  text: string,
  targetCefr: Cefr,
  cefrData: CefrData,
  grammarMap: GrammarMap = GRAMMAR_MAP,
  compiledMarkers?: Array<RegExp[]>,
): ValidationResult {
  const markers = compiledMarkers ?? compileMarkers(grammarMap);
  const violations: Violation[] = [
    ...wordViolations(text, targetCefr, cefrData),
    ...grammarViolations(text, targetCefr, grammarMap, markers),
  ];
  return { ok: violations.length === 0, violations };
}

/**
 * Concrete implementation of {@link ContentValidator}.
 * Holds pre-loaded data and delegates to the pure {@link validate} function.
 * Wired in the generate-validate-cache pipeline (Phase 1.7).
 */
export class LocalContentValidator implements ContentValidator {
  private readonly compiledMarkers: Array<RegExp[]>;

  constructor(
    private readonly cefrData: CefrData,
    private readonly grammarMap: GrammarMap = GRAMMAR_MAP,
  ) {
    // Pre-compile once at construction so validate() pays no regex compile cost.
    this.compiledMarkers = compileMarkers(grammarMap);
  }

  validate(text: string, targetCefr: Cefr): ValidationResult {
    return validate(text, targetCefr, this.cefrData, this.grammarMap, this.compiledMarkers);
  }
}
