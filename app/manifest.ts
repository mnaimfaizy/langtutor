import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest; Next auto-injects the <link rel="manifest">. Icons are
// placeholder marks (see scripts/generate-icons.mjs) — real artwork lands in Phase 8.4.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lang-Tutor",
    short_name: "Lang-Tutor",
    description:
      "A private, local-first English tutor — reading, writing, listening, and speaking.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
