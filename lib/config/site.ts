/**
 * Canonical, absolute site URL used for metadata (Open Graph, Twitter card, canonical link)
 * that requires a fully-qualified origin rather than a path.
 *
 * Resolution order: explicit `NEXT_PUBLIC_SITE_URL` → Vercel's auto-injected `VERCEL_URL`
 * (preview/production deploys) → localhost for local dev. Not part of `lib/config/env.ts`'s
 * Zod-validated schema because it is purely presentational (metadata only) and has a safe
 * fallback in every environment, unlike the secrets/connection strings validated there.
 */
export const SITE_URL = resolveSiteUrl();

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return "http://localhost:3000";
}
