import "server-only";

/** Cloudflare Workers AI REST base (account-scoped run URL is built by the generator). */
export const CLOUDFLARE_AI_BASE_URL = "https://api.cloudflare.com/client/v4/accounts";

/** Default Workers AI FLUX.1-schnell model id. */
export const DEFAULT_CLOUDFLARE_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

/** Read the Cloudflare Account ID from server env (never persisted in the database). */
export function getCloudflareAccountId(): string | undefined {
  const id = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  return id ? id : undefined;
}

/** Read the Cloudflare API token from server env (never persisted in the database). */
export function getCloudflareApiToken(): string | undefined {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  return token ? token : undefined;
}
