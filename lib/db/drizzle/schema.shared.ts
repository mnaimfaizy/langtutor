export const CEFR_VALUES = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const SKILL_VALUES = ["reading", "writing", "listening", "speaking"] as const;
export const CONTENT_TYPE_VALUES = ["passage", "quiz", "prompt", "lesson"] as const;
export const CONTENT_SOURCE_VALUES = ["seed", "generated", "agent"] as const;
export const USER_ROLE_VALUES = ["admin", "standard"] as const;

/** Bootstrap userId for local SQLite migrations from Phase 1a data. */
export const BOOTSTRAP_ADMIN_ID = "00000000-0000-0000-0000-000000000001";
