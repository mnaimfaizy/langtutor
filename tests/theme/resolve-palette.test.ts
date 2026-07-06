import { describe, expect, it } from "vitest";

import { resolvePalette } from "@/lib/theme/resolve-palette";

describe("resolvePalette", () => {
  it("maps adult + light to adult-light", () => {
    expect(resolvePalette("adult", "light")).toBe("adult-light");
  });

  it("maps adult + dark to adult-dark", () => {
    expect(resolvePalette("adult", "dark")).toBe("adult-dark");
  });

  it("maps kid + light to kid-bright", () => {
    expect(resolvePalette("kid", "light")).toBe("kid-bright");
  });

  it("maps kid + dark to kid-dark", () => {
    expect(resolvePalette("kid", "dark")).toBe("kid-dark");
  });
});
