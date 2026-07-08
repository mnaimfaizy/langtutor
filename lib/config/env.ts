import { z } from "zod";

const sessionSecretSchema = z.string().refine((s) => s !== "change-me-in-production", {
  message: "Insecure placeholder — set LANGTUTOR_SESSION_SECRET to a real secret in .env.local",
});

const macConfigFields = {
  MAC_LLM_BASE_URL: z.string().url().default("http://localhost:11434/v1"),
  MAC_LLM_API_KEY: z.string().default("ollama"),
  MAC_LLM_MODEL: z.string().default("qwen2.5:14b-instruct"),
  MAC_UTILITY_MODEL: z.string().default("qwen2.5:7b-instruct"),
  MAC_EMBED_MODEL: z.string().default("nomic-embed-text"),
  MAC_STT_URL: z.string().url().default("http://localhost:8080"),
  /** Groq API key — server-only; optional until chat/stt provider is set to groq. */
  GROQ_API_KEY: z.string().min(1).optional(),
  /** Optional env-first default Groq chat model. */
  GROQ_CHAT_MODEL: z.string().min(1).optional(),
  /** Optional env-first default Groq STT model. */
  GROQ_STT_MODEL: z.string().min(1).optional(),
  /** Mistral API key — server-only; optional until embeddingsProvider is set to mistral. */
  MISTRAL_API_KEY: z.string().min(1).optional(),
  /** Optional env-first default Mistral embeddings model. */
  MISTRAL_EMBED_MODEL: z.string().min(1).optional(),
  /** NVIDIA NIM API key — server-only; required for pre-A1 image generation (ADR 0016). */
  NVIDIA_NIM_API_KEY: z.string().min(1).optional(),
};

const localConfigSchema = z.object({
  LANGTUTOR_MODE: z.literal("local"),
  /** Path to the SQLite database file. Default: ./langtutor.db */
  LANGTUTOR_DB_PATH: z.string().default("./langtutor.db"),
  LANGTUTOR_SESSION_SECRET: sessionSecretSchema,
  ...macConfigFields,
});

const cloudConfigSchema = z.object({
  LANGTUTOR_MODE: z.literal("cloud"),
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LANGTUTOR_ADMIN_EMAIL: z.string().email(),
  LANGTUTOR_ADMIN_PASSWORD: z.string().min(8),
  LANGTUTOR_SESSION_SECRET: sessionSecretSchema,
  ...macConfigFields,
});

export type LocalConfig = z.infer<typeof localConfigSchema>;
export type CloudConfig = z.infer<typeof cloudConfigSchema>;
export type AppEnv = LocalConfig | CloudConfig;

export const appEnvSchema = z.discriminatedUnion("LANGTUTOR_MODE", [
  localConfigSchema,
  cloudConfigSchema,
]);

function normalizeEnvValue(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  const trimmed = value.trim();
  const hasMatchingSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");
  const hasMatchingDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');

  if ((hasMatchingSingleQuotes || hasMatchingDoubleQuotes) && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function normalizeEnv(raw: Record<string, string | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, normalizeEnvValue(value)]),
  );
}

/**
 * Parse and validate the environment. Accepts an explicit env map (for tests); defaults
 * to process.env. LANGTUTOR_MODE defaults to "local" when not set.
 *
 * Throws with a clear diagnostic on any missing or invalid value.
 */
export function parseEnv(raw: Record<string, string | undefined> = process.env): AppEnv {
  const input = { LANGTUTOR_MODE: "local", ...normalizeEnv(raw) };
  const result = appEnvSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    const hints = Array.from(
      new Set(
        result.error.issues.flatMap((issue) => {
          const path = issue.path.join(".");
          if (path === "NEXT_PUBLIC_SUPABASE_URL") {
            return [
              "NEXT_PUBLIC_SUPABASE_URL should look like https://<project-ref>.supabase.co",
              "In Vercel env vars, do not wrap URLs in quotes.",
            ];
          }
          return [];
        }),
      ),
    );

    const hintText =
      hints.length > 0 ? `\n\nHints:\n${hints.map((hint) => `  • ${hint}`).join("\n")}` : "";

    throw new Error(
      `[LangTutor] Invalid environment configuration:\n${issues}${hintText}\n\nSee .env.example for reference.`,
    );
  }
  return result.data;
}

/** Validated environment — fails fast on first import if config is invalid. */
export const env: AppEnv = parseEnv();
