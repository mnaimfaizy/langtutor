import { describe, expect, it } from "vitest";

import { paletteBootstrapScript } from "@/lib/theme/palette-bootstrap-script";

describe("paletteBootstrapScript", () => {
  it("seeds the inline script with the given initial mode", () => {
    expect(paletteBootstrapScript("kid")).toContain('"kid"');
    expect(paletteBootstrapScript("adult")).toContain('"adult"');
  });

  it("resolves to the bright kid palette in light scheme", () => {
    const script = paletteBootstrapScript("kid");
    expect(script).toContain("kid-bright");
    expect(script).toContain("kid-dark");
  });

  it("sets data-palette and reacts to system scheme changes", () => {
    const script = paletteBootstrapScript("adult");
    expect(script).toContain('setAttribute("data-palette"');
    expect(script).toContain("prefers-color-scheme: dark");
    expect(script).toContain("addEventListener");
  });
});
