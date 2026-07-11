export const CEFR_VALUES = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const SKILL_VALUES = ["reading", "writing", "listening", "speaking"] as const;
export const CONTENT_TYPE_VALUES = ["passage", "quiz", "prompt", "lesson"] as const;
export const CONTENT_SOURCE_VALUES = ["seed", "generated", "agent"] as const;
export const USER_ROLE_VALUES = ["admin", "standard"] as const;
export const CHAT_PROVIDER_VALUES = ["mac", "groq"] as const;
export const STT_PROVIDER_VALUES = ["mac", "groq"] as const;
export const EMBEDDINGS_PROVIDER_VALUES = ["mac", "mistral"] as const;
export const EXPERIENCE_MODE_VALUES = ["adult", "kid"] as const;
export const UNIT_STATUS_VALUES = ["locked", "available", "in-progress", "completed"] as const;
export const UNIT_BUFFER_STATUS_VALUES = ["empty", "buffered"] as const;
export const MEDIA_ASSET_KIND_VALUES = ["image", "audio"] as const;
export const MEDIA_ASSET_SOURCE_VALUES = ["generated", "curated-pack"] as const;
export const MEDIA_ASSET_APPROVAL_STATUS_VALUES = ["pending", "approved"] as const;
export const COLLECTION_KIND_VALUES = ["user", "unit"] as const;
export const CHAPTER_TIER_VALUES = ["pre-A1", "A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const CHAPTER_GATE_STATUS_VALUES = ["pending", "passed"] as const;
export const PROGRESSION_MODE_VALUES = ["strict", "open"] as const;

export type ChatProvider = (typeof CHAT_PROVIDER_VALUES)[number];
export type SttProvider = (typeof STT_PROVIDER_VALUES)[number];
export type EmbeddingsProvider = (typeof EMBEDDINGS_PROVIDER_VALUES)[number];

/** Bootstrap userId for local SQLite migrations from Phase 1a data. */
export const BOOTSTRAP_ADMIN_ID = "00000000-0000-0000-0000-000000000001";
