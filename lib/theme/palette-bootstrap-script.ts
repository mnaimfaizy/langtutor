import { DEFAULT_EXPERIENCE_MODE } from "./types";

/**
 * Blocking inline script for the document `<head>`. Sets `data-palette` from system
 * light/dark before first paint; mirrors `resolvePalette` with the default adult mode.
 */
export const PALETTE_BOOTSTRAP_SCRIPT = `(function(defaultMode){function resolve(mode,scheme){if(mode==="kid")return scheme==="dark"?"kid-dark":"kid-bright";return scheme==="dark"?"adult-dark":"adult-light"}function apply(){var dark=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.setAttribute("data-palette",resolve(defaultMode,dark?"dark":"light"))}apply();window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",apply)})("${DEFAULT_EXPERIENCE_MODE}");`;
