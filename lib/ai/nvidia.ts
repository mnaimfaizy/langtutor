import "server-only";

/** NVIDIA cloud GenAI API base URL for hosted image models (FLUX.1-schnell, etc.). */
export const NVIDIA_GENAI_BASE_URL = "https://ai.api.nvidia.com/v1/genai";

/** Default hosted image model — fast FLUX.1-schnell (Apache 2.0). */
export const DEFAULT_NVIDIA_IMAGE_MODEL = "black-forest-labs/flux.1-schnell";

/** Read the NVIDIA NIM API key from server env (never persisted in the database). */
export function getNvidiaNimApiKey(): string | undefined {
  const key = process.env.NVIDIA_NIM_API_KEY?.trim();
  return key ? key : undefined;
}
