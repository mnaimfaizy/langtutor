/**
 * Throwaway kids-island asset catalog — prompts for Cloudflare/NIM via ImageGenerator.
 * Keys become `/api/prototype/kids-island-asset?id=<key>` (and cached under public/).
 *
 * Art-direction rule: backgrounds are empty scenic plates (no painted path/landmarks).
 * The UI owns the trail + stops so portrait/landscape stay consistent.
 */

export const KIDS_ISLAND_STYLE = "prototype-kids-island";

/** Shared look so sprites match the island plate lighting. */
const PROP_STYLE =
  "soft warm sunlight from upper-left, gentle contact shadow underneath, cute premium children's 3D game art, same tropical palette as a sunny island (sand beige, leaf green, ocean teal accents), plain solid white background, no text, no watermark, no UI chrome";

export type KidsIslandAssetId =
  | "island-bg"
  | "island-bg-portrait"
  | "island-bg-landscape"
  | "chest-open"
  | "chest-locked"
  | "sandcastle"
  | "pirate-wreck"
  | "monkey-palms"
  | "stump-play"
  | "pip-aviator";

export interface KidsIslandAssetDef {
  id: KidsIslandAssetId;
  /** Stable seed so regenerations stay consistent. */
  seed: number;
  prompt: string;
}

const EMPTY_TERRAIN_RULES = [
  "IMPORTANT: leave the grassy center and beaches EMPTY for a game path to be drawn later.",
  "Do NOT paint any roads, stone paths, trails, footprints, characters, chests, buildings,",
  "UI buttons, text, letters, watermarks, or logos.",
  "Soft 3D cartoon children's game environment, warm sunny lighting, cohesive tropical palette.",
].join(" ");

export const KIDS_ISLAND_ASSETS: Record<KidsIslandAssetId, KidsIslandAssetDef> = {
  /** Legacy id — same plate as portrait for older caches. */
  "island-bg": {
    id: "island-bg",
    seed: 520101,
    prompt: [
      "Top-down children's game environment painting of one lush tropical island in bright turquoise ocean,",
      "coral reefs and soft waves around the shore, sandy beaches, palm clusters only at the edges,",
      "open green meadows and gentle hills in the middle with clear empty space,",
      EMPTY_TERRAIN_RULES,
    ].join(" "),
  },
  "island-bg-portrait": {
    id: "island-bg-portrait",
    seed: 520102,
    prompt: [
      "Tall top-down children's game map plate of a tropical island framed for a portrait phone screen,",
      "ocean around all edges, sandy beaches, palm trees pushed to the sides and corners,",
      "wide open grassy center corridor running from top to bottom for a future winding path,",
      EMPTY_TERRAIN_RULES,
    ].join(" "),
  },
  "island-bg-landscape": {
    id: "island-bg-landscape",
    seed: 520103,
    prompt: [
      "Wide top-down children's game map plate of a tropical island framed for a landscape desktop screen,",
      "ocean around all edges, sandy beaches, palm trees pushed to the top and bottom edges,",
      "wide open grassy center corridor running left to right for a future winding path,",
      EMPTY_TERRAIN_RULES,
    ].join(" "),
  },
  "chest-open": {
    id: "chest-open",
    seed: 520202,
    prompt: [
      "Cute 3D cartoon golden treasure chest slightly open with warm glow,",
      "sitting on a small round sandy pedestal,",
      PROP_STYLE,
    ].join(" "),
  },
  "chest-locked": {
    id: "chest-locked",
    seed: 520203,
    prompt: [
      "Cute 3D cartoon closed wooden treasure chest with a silver padlock,",
      "sitting on a small round sandy pedestal,",
      PROP_STYLE,
    ].join(" "),
  },
  sandcastle: {
    id: "sandcastle",
    seed: 520204,
    prompt: [
      "Cute 3D cartoon sandcastle with colorful alphabet letter blocks and tiny flags,",
      "sitting on a sandy mound,",
      PROP_STYLE,
    ].join(" "),
  },
  "pirate-wreck": {
    id: "pirate-wreck",
    seed: 520205,
    prompt: [
      "Cute friendly 3D cartoon wooden pirate shipwreck on sand with a small smiling pirate kid and seagulls,",
      PROP_STYLE,
    ].join(" "),
  },
  "monkey-palms": {
    id: "monkey-palms",
    seed: 520206,
    prompt: [
      "Cute 3D cartoon palm trees with two friendly monkeys hanging from vines,",
      "roots sitting on a small grassy mound,",
      PROP_STYLE,
    ].join(" "),
  },
  "stump-play": {
    id: "stump-play",
    seed: 520207,
    prompt: [
      "Cute 3D cartoon tree stump with a glowing orange circular play button on top,",
      PROP_STYLE,
    ].join(" "),
  },
  "pip-aviator": {
    id: "pip-aviator",
    seed: 520208,
    prompt: [
      "Cute 3D cartoon fox mascot wearing aviator goggles and a little scarf,",
      "friendly wave pose,",
      PROP_STYLE,
    ].join(" "),
  },
};

export function kidsIslandAssetUrl(id: KidsIslandAssetId, refresh = false): string {
  const base = `/api/prototype/kids-island-asset?id=${encodeURIComponent(id)}`;
  return refresh ? `${base}&refresh=1` : base;
}

export function islandBackgroundId(
  orientation: "portrait" | "landscape",
): KidsIslandAssetId {
  return orientation === "portrait" ? "island-bg-portrait" : "island-bg-landscape";
}
