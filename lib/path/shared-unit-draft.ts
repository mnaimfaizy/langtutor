/**
 * Shared pre-A1 unit draft: Zod schema + guide-grounded prompt (ADR 0052, issue #131).
 *
 * AI may densify Phonics / Picture words / Listen & tap into the **shared pending**
 * cache only. Alphabet stays human-authored. Prompts consult spine + short excerpts
 * via the curriculum-guide retrieve helper — never full commercial corpora.
 */
import { z } from "zod";

import { formatGuideSectionsForPrompt, retrieveRelevantSections } from "@/lib/curriculum-guides";
import type { PreA1StageId } from "@/lib/db";
import type { ChatMessage } from "@/lib/llm/types";

import { PRE_A1_STAGE_SPINE_KEYS } from "./shared-path-catalog";

/** Later stages eligible for AI densification (Alphabet is human-authored). */
export const AI_DRAFTABLE_STAGE_IDS = ["phonics", "picture-words", "listen-tap"] as const;
export type AiDraftableStageId = (typeof AI_DRAFTABLE_STAGE_IDS)[number];

export const AiDraftableStageIdSchema = z.enum(AI_DRAFTABLE_STAGE_IDS);

export const SharedUnitDraftVocabItemSchema = z.object({
  word: z.string().min(1).max(40),
  /**
   * Kid-facing sense + image hint — what the word means in this unit, concrete
   * enough to draw (e.g. "a soft floor covering" not just "sat / Pat").
   */
  sense: z.string().min(1).max(120),
});

export const SharedUnitDraftSchema = z.object({
  title: z.string().min(1).max(120),
  teacherNote: z.string().min(1).max(500),
  targetVocab: z.array(SharedUnitDraftVocabItemSchema).min(3).max(8),
});

export type SharedUnitDraftPayload = z.infer<typeof SharedUnitDraftSchema>;

export function isAiDraftableStageId(stageId: PreA1StageId): stageId is AiDraftableStageId {
  return (AI_DRAFTABLE_STAGE_IDS as readonly string[]).includes(stageId);
}

/** Guide section keys that ground a draft for each later stage. */
export const STAGE_DRAFT_GUIDE_KEYS: Record<AiDraftableStageId, readonly string[]> = {
  phonics: [
    "spine.overview",
    PRE_A1_STAGE_SPINE_KEYS.phonics,
    "spine.stages.letters-and-sounds",
    "phonics.ladder.overview",
    "phonics.phase.early-gpcs",
    "phonics.out-of-scope",
    "excerpts.starters.intent",
    "excerpts.starters.skill-families",
    "spine.teaching-stance",
  ],
  "picture-words": [
    "spine.overview",
    PRE_A1_STAGE_SPINE_KEYS["picture-words"],
    "excerpts.starters.intent",
    "excerpts.starters.skill-families",
    "spine.teaching-stance",
  ],
  "listen-tap": [
    "spine.overview",
    PRE_A1_STAGE_SPINE_KEYS["listen-tap"],
    "excerpts.starters.intent",
    "excerpts.starters.skill-families",
    "spine.teaching-stance",
  ],
};

const STAGE_LABEL: Record<AiDraftableStageId, string> = {
  phonics: "Phonics",
  "picture-words": "Picture words",
  "listen-tap": "Listen & tap",
};

const STAGE_FOCUS: Record<AiDraftableStageId, string> = {
  phonics:
    "Reliable single-letter GPCs and blending of very short imageable nouns " +
    "(CVC picture words a five-year-old can draw: cat, dog, sun, pig, cup). " +
    "Every word must be a concrete noun with a clear picture sense — never verbs, " +
    "names, or ambiguous words (no sat, Pat, run, set). Stay on the early phonics " +
    "ladder — no complex digraph charts or A1 grammar.",
  "picture-words":
    "High-frequency concrete nouns and everyday labels (colours, family, food, animals, " +
    "classroom objects). Match picture ↔ word; invent original Lang-Tutor vocab — never paste " +
    "commercial wordlists. Each word needs a clear drawable sense.",
  "listen-tap":
    "Recognise spoken concrete nouns from a short spoken prompt. Single-word recognition " +
    "with fair beginner distractors. Prefer imageable nouns with an unambiguous picture sense. " +
    "No full dialogues.",
};

const VOCAB_RULES =
  "Vocab rules (all stages):\n" +
  "- Prefer concrete, drawable nouns a child can see in a picture book.\n" +
  "- Reject ambiguous or hard-to-illustrate words (verbs like sat/run, names like Pat, " +
  "abstract words).\n" +
  "- For each word, write a short sense that disambiguates meaning for image generation " +
  '(e.g. word "mat" → sense "a soft floor covering for wiping shoes").\n' +
  "- Keep words lowercase single tokens; max 6 letters preferred for phonics.";

/**
 * Builds chat messages for one shared densification draft, grounded in retrieved
 * spine + excerpt sections for the target stage.
 */
export function buildSharedUnitDraftMessages(stageId: AiDraftableStageId): ChatMessage[] {
  const sections = retrieveRelevantSections(STAGE_DRAFT_GUIDE_KEYS[stageId]);
  const grounding = formatGuideSectionsForPrompt(sections);

  return [
    {
      role: "system",
      content:
        "You are a kindergarten English curriculum author drafting ONE original Pre-A1 unit " +
        "template for a shared learning path used by every beginner. Write warm, concrete, " +
        "playful titles and teacher notes a five-year-old context can support. Invent original " +
        "Lang-Tutor wording — never copy commercial handbook text or wordlists. Stay inside " +
        "the stage focus; do not invent A1 grammar constructions or private per-learner paths.",
    },
    {
      role: "user",
      content:
        `Draft one densification unit for the shared Pre-A1 stage: ${STAGE_LABEL[stageId]}.\n\n` +
        `Stage focus:\n${STAGE_FOCUS[stageId]}\n\n` +
        `${VOCAB_RULES}\n\n` +
        (grounding
          ? `Curriculum guide excerpts (orientation only — invent original content):\n\n${grounding}\n\n`
          : "") +
        `Return a JSON object with exactly three fields:\n` +
        `- title: short playful unit title (max 8 words), preferably "Pre-A1: ${STAGE_LABEL[stageId]} — …"\n` +
        `- teacherNote: one or two short warm sentences describing what the learner practices\n` +
        `- targetVocab: array of 3 to 6 objects, each { "word": "...", "sense": "..." } where ` +
        `sense is a short kid-facing meaning that makes the picture obvious`,
    },
  ];
}
