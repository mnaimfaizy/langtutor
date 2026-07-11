/**
 * Static kid-island art (Pre-A1 kid home, ADR 0016 "generate once, store forever"). These
 * JPEGs were generated once via the `ImageGenerator` seam during prototyping, reviewed, and
 * committed to `public/kid-island/` — production never calls a generation API at request
 * time. To regenerate/tweak an asset, use the dev-only workshop at
 * `app/home/prototype-kids/` and copy the result back into `public/kid-island/`.
 */

export type KidIslandAssetId =
  | "island-bg-portrait"
  | "island-bg-landscape"
  | "chest-open"
  | "chest-locked"
  | "sandcastle"
  | "pirate-wreck"
  | "monkey-palms"
  | "pip-aviator";

const ASSET_PATHS: Record<KidIslandAssetId, string> = {
  "island-bg-portrait": "/kid-island/island-bg-portrait.jpg",
  "island-bg-landscape": "/kid-island/island-bg-landscape.jpg",
  "chest-open": "/kid-island/chest-open.jpg",
  "chest-locked": "/kid-island/chest-locked.jpg",
  sandcastle: "/kid-island/sandcastle.jpg",
  "pirate-wreck": "/kid-island/pirate-wreck.jpg",
  "monkey-palms": "/kid-island/monkey-palms.jpg",
  "pip-aviator": "/kid-island/pip-aviator.jpg",
};

export function kidIslandAssetUrl(id: KidIslandAssetId): string {
  return ASSET_PATHS[id];
}

export function islandBackgroundId(orientation: "portrait" | "landscape"): KidIslandAssetId {
  return orientation === "portrait" ? "island-bg-portrait" : "island-bg-landscape";
}
