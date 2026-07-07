import { z } from "zod";

const CefrSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
const SkillSchema = z.enum(["reading", "writing", "listening", "speaking"]);

const ProfileRowSchema = z.object({
  id: z.literal(1),
  cefrLevel: CefrSchema.optional(),
  goals: z.array(z.enum(["travel", "work", "exam", "general"])),
  createdAt: z.coerce.date(),
  experienceMode: z.enum(["adult", "kid"]).optional(),
  settings: z.object({
    macLlmBaseUrl: z.string().optional(),
    macLlmModel: z.string().optional(),
    macUtilityModel: z.string().optional(),
    macEmbedModel: z.string().optional(),
    macSttUrl: z.string().optional(),
    ttsRate: z.number().optional(),
    ttsVoiceUri: z.string().optional(),
    ttsLang: z.string().optional(),
  }),
});

const FsrsStateSchema = z.object({
  due: z.coerce.date(),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number(),
  scheduledDays: z.number(),
  reps: z.number(),
  lapses: z.number(),
  learningSteps: z.number().optional(),
  state: z.number(),
  lastReview: z.coerce.date().optional(),
});

const CardRowSchema = z.object({
  id: z.number(),
  word: z.string(),
  sense: z.string().optional(),
  definition: z.string(),
  examples: z.array(z.string()),
  cefr: CefrSchema,
  fsrs: FsrsStateSchema,
  createdAt: z.coerce.date(),
  embedding: z.array(z.number()).optional(),
});

const ContentRowSchema = z.object({
  id: z.number(),
  type: z.enum(["passage", "quiz", "prompt", "lesson"]),
  level: CefrSchema,
  topic: z.string(),
  payload: z.unknown(),
  source: z.enum(["seed", "generated", "agent"]),
  validatedAt: z.coerce.date(),
  embedding: z.array(z.number()).optional(),
});

const ErrorEventRowSchema = z.object({
  id: z.number(),
  skill: SkillSchema,
  category: z.string(),
  cefr: CefrSchema,
  context: z.string(),
  createdAt: z.coerce.date(),
});

const WeaknessRowSchema = z.object({
  skill: SkillSchema,
  category: z.string(),
  cefr: CefrSchema,
  score: z.number(),
  confidence: z.number(),
  updatedAt: z.coerce.date(),
});

const GamificationRowSchema = z.object({
  id: z.literal(1),
  xp: z.number(),
  level: z.number(),
  streakCount: z.number(),
  lastActivityDate: z.string().nullable(),
  achievements: z.array(
    z.object({
      id: z.string(),
      unlockedAt: z.coerce.date(),
    }),
  ),
});

const LexiconCacheRowSchema = z.object({
  word: z.string(),
  data: z.unknown(),
  cachedAt: z.coerce.date(),
});

const ActivityKindSchema = z.union([SkillSchema, z.literal("review")]);

const UnitActivityRefSchema = z.object({
  skill: ActivityKindSchema,
  contentId: z.number().optional(),
  // Default handles backups exported before the unit player (issue #59) existed.
  done: z.boolean().optional(),
});

const UnitRowSchema = z.object({
  id: z.number(),
  index: z.number(),
  title: z.string(),
  teacherNote: z.string(),
  targetGrammarIds: z.array(z.string()),
  // Default handles backups exported before the teacher planner (issue #58) existed.
  targetVocab: z.array(z.string()).default([]),
  targetCefr: CefrSchema,
  activities: z.array(UnitActivityRefSchema),
  status: z.enum(["locked", "available", "in-progress", "completed"]),
  bufferStatus: z.enum(["empty", "buffered"]),
  createdAt: z.coerce.date(),
});

export const BackupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  tables: z.object({
    profile: z.array(ProfileRowSchema),
    cards: z.array(CardRowSchema),
    content: z.array(ContentRowSchema),
    errorEvents: z.array(ErrorEventRowSchema),
    weakness: z.array(WeaknessRowSchema),
    gamification: z.array(GamificationRowSchema),
    lexiconCache: z.array(LexiconCacheRowSchema),
    // Optional: absent in backups exported before units existed (issue #57).
    units: z.array(UnitRowSchema).optional(),
  }),
});

export type BackupData = z.infer<typeof BackupSchema>;
