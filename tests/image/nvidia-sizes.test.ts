import { describe, expect, it } from "vitest";

import { snapNvidiaFluxSize, DEFAULT_NVIDIA_IMAGE_SIZE } from "@/lib/image/nvidia-sizes";

describe("snapNvidiaFluxSize", () => {
  it("defaults to 1024 when undefined", () => {
    expect(snapNvidiaFluxSize(undefined)).toBe(DEFAULT_NVIDIA_IMAGE_SIZE);
  });

  it("keeps allowed sizes unchanged", () => {
    expect(snapNvidiaFluxSize(1024)).toBe(1024);
    expect(snapNvidiaFluxSize(768)).toBe(768);
  });

  it("snaps 512 to the nearest allowed size (768)", () => {
    expect(snapNvidiaFluxSize(512)).toBe(768);
  });
});
