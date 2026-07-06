import type { ExperienceMode } from "./types";

/**
 * Blocking inline script for the document `<head>`. Sets `data-palette` from system
 * light/dark before first paint. `initialMode` is resolved server-side (the signed-in
 * user's stored {@link ExperienceMode}, or the default) so the very first paint already
 * reflects the account's mode — no flash while the client re-fetches it.
 */
export function paletteBootstrapScript(initialMode: ExperienceMode): string {
  return `(function(defaultMode){function resolve(mode,scheme){if(mode==="kid")return scheme==="dark"?"kid-dark":"kid-bright";return scheme==="dark"?"adult-dark":"adult-light"}function apply(){var dark=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.setAttribute("data-palette",resolve(defaultMode,dark?"dark":"light"))}apply();window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",apply)})("${initialMode}");`;
}
