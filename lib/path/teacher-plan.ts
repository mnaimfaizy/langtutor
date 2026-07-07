/**
 * LLM-teacher unit plan: Zod schema + prompt builder (ADR 0015, issue #58).
 *
 * One planner, two registers: the system persona is a professional English teacher in
 * adult mode and a kindergarten teacher in kid mode — a prompt-level difference only.
 * The chat → Zod-parse → corrective-retry flow (`lib/content/pipeline.ts`) is identical
 * for both; nothing here forks on `experienceMode` except the strings sent to the model.
 *
 * The schema is deliberately small: the backbone (`lib/path/backbone-planner.ts`) already
 * fixes each unit's ordering and grammar-construction anchor, so the LLM only fills the
 * register-appropriate title/note and picks target vocabulary — fewer fields the model
 * must get right means fewer corrective retries (per the PRD).
 */
import { z } from "zod";

import type { GrammarConstruction } from "@/lib/content/grammar-map";
import type { Cefr, ExperienceMode, LearnerGoal, Weakness } from "@/lib/db";
import type { ChatMessage } from "@/lib/llm/types";

export const UnitPlanSchema = z.object({
  title: z.string().min(1).max(120),
  teacherNote: z.string().min(1).max(500),
  targetVocab: z.array(z.string().min(1).max(40)).min(3).max(10),
});

export type UnitPlanPayload = z.infer<typeof UnitPlanSchema>;

/** Context the planner needs to plan exactly one backbone-anchored unit. */
export interface TeacherPlanContext {
  experienceMode: ExperienceMode;
  cefrLevel: Cefr;
  goals: LearnerGoal[];
  /** The backbone construction this unit is anchored to — fixed, never chosen by the LLM. */
  construction: GrammarConstruction;
  /** The learner's current weakness rollup (weakness engine, `lib/diagnostics/weakness.ts`). */
  weaknesses: Weakness[];
}

const GOAL_LABEL: Record<LearnerGoal, string> = {
  travel: "traveling and getting around in English",
  work: "using English at work",
  exam: "passing an English exam",
  general: "general everyday English",
};

function goalsSummary(goals: LearnerGoal[]): string {
  if (goals.length === 0) return "general English improvement";
  return goals.map((g) => GOAL_LABEL[g]).join(", ");
}

/** Weaknesses worth mentioning to the planner — low-confidence noise is filtered out. */
const WEAKNESS_SCORE_THRESHOLD = 0.35;
const WEAKNESS_CONFIDENCE_THRESHOLD = 0.2;
const MAX_WEAKNESSES_IN_PROMPT = 3;

function weaknessSummary(weaknesses: Weakness[]): string | null {
  const relevant = weaknesses
    .filter(
      (w) => w.score >= WEAKNESS_SCORE_THRESHOLD && w.confidence >= WEAKNESS_CONFIDENCE_THRESHOLD,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_WEAKNESSES_IN_PROMPT);

  if (relevant.length === 0) return null;
  return relevant.map((w) => `${w.category} (${w.skill})`).join(", ");
}

const ADULT_PERSONA = (level: Cefr): string =>
  `You are an experienced, professional English teacher planning one unit of a personalised ` +
  `course for an adult learner at CEFR ${level}. Write like a thoughtful teacher: clear, ` +
  `encouraging, and precise. Ground the unit in the learner's goals and explain the grammar ` +
  `rationale briefly — treat the learner as a capable adult, never talk down to them.`;

const KID_PERSONA = (level: Cefr): string =>
  `You are a warm, cheerful kindergarten English teacher planning one fun lesson for a young ` +
  `child learner at CEFR ${level}. Use very simple, playful, encouraging words a five-year-old ` +
  `can understand. Keep everything short and full of encouragement — never use technical ` +
  `grammar terms.`;

function personaFor(mode: ExperienceMode, level: Cefr): string {
  return mode === "kid" ? KID_PERSONA(level) : ADULT_PERSONA(level);
}

function taskFor(mode: ExperienceMode): string {
  if (mode === "kid") {
    return (
      `- title: a short, fun, exciting unit title a young child would love (max 8 words)\n` +
      `- teacherNote: one or two short, warm, encouraging sentences in very simple words — no grammar jargon\n` +
      `- targetVocab: 3 to 6 simple, concrete English words for this level that fit the unit's topic`
    );
  }
  return (
    `- title: a short, clear, motivating unit title (max 8 words)\n` +
    `- teacherNote: two to three sentences explaining this unit's goal and how the grammar focus ` +
    `connects to the learner's stated goals\n` +
    `- targetVocab: 5 to 8 useful English words for this level that fit the unit's topic and grammar focus`
  );
}

/**
 * Builds the chat messages for planning one unit. The backbone construction/ordering are
 * fixed inputs, never something the model is asked to choose — the plan schema only asks
 * for the register-appropriate title/note and a vocab list (ADR 0015).
 */
export function buildTeacherPlanMessages(ctx: TeacherPlanContext): ChatMessage[] {
  const { experienceMode, cefrLevel, goals, construction, weaknesses } = ctx;
  const weaknessNote = weaknessSummary(weaknesses);

  const contextLines = [
    `This unit's fixed grammar focus (keep it — do not invent a different one) is ` +
      `"${construction.label}": ${construction.description}` +
      (construction.examples[0] ? ` For example: "${construction.examples[0]}"` : ""),
    weaknessNote
      ? `The learner has recently struggled with: ${weaknessNote}. Where it fits naturally, let the ` +
        `unit's vocabulary or note help with this.`
      : `There is no weakness data yet for this learner — plan for a typical learner at this level.`,
    `Learner goals: ${goalsSummary(goals)}.`,
  ];

  return [
    { role: "system", content: personaFor(experienceMode, cefrLevel) },
    {
      role: "user",
      content:
        `${contextLines.join("\n\n")}\n\n` +
        `Return a JSON object with exactly three fields:\n${taskFor(experienceMode)}`,
    },
  ];
}
