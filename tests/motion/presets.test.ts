import { describe, expect, it } from "vitest";

import { MOTION_DURATIONS, resolveMotionPreset } from "@/lib/motion";

describe("resolveMotionPreset", () => {
  describe("enter", () => {
    it("uses opacity + vertical offset when motion is allowed", () => {
      const preset = resolveMotionPreset("enter", false);
      expect(preset.initial).toEqual({ opacity: 0, y: 6 });
      expect(preset.animate).toEqual({ opacity: 1, y: 0 });
      expect(preset.exit).toEqual({ opacity: 0, y: -4 });
      expect(preset.transition).toEqual({ duration: MOTION_DURATIONS.enter, ease: "easeInOut" });
    });

    it("falls back to opacity-only when reduced motion is requested", () => {
      const preset = resolveMotionPreset("enter", true);
      expect(preset.initial).toEqual({ opacity: 0 });
      expect(preset.animate).toEqual({ opacity: 1 });
      expect(preset.exit).toEqual({ opacity: 0 });
      expect(preset.transition.duration).toBe(MOTION_DURATIONS.enterReduced);
      expect(preset.initial).not.toHaveProperty("y");
    });
  });

  describe("press", () => {
    it("uses scale feedback when motion is allowed", () => {
      const preset = resolveMotionPreset("press", false);
      expect(preset.whileTap).toEqual({ scale: 0.97 });
      expect(preset.transition.duration).toBe(MOTION_DURATIONS.press);
    });

    it("falls back to opacity feedback when reduced motion is requested", () => {
      const preset = resolveMotionPreset("press", true);
      expect(preset.whileTap).toEqual({ opacity: 0.88 });
      expect(preset.whileTap).not.toHaveProperty("scale");
      expect(preset.transition.duration).toBe(MOTION_DURATIONS.pressReduced);
    });
  });

  describe("celebrate", () => {
    it("uses scale entrance when motion is allowed", () => {
      const preset = resolveMotionPreset("celebrate", false);
      expect(preset.initial).toEqual({ opacity: 0, scale: 0.92 });
      expect(preset.animate).toEqual({ opacity: 1, scale: 1 });
      expect(preset.transition.duration).toBe(MOTION_DURATIONS.celebrate);
    });

    it("falls back to opacity-only when reduced motion is requested", () => {
      const preset = resolveMotionPreset("celebrate", true);
      expect(preset.initial).toEqual({ opacity: 0 });
      expect(preset.animate).toEqual({ opacity: 1 });
      expect(preset.initial).not.toHaveProperty("scale");
      expect(preset.transition.duration).toBe(MOTION_DURATIONS.celebrateReduced);
    });
  });

  describe("path-fill", () => {
    it("uses a smooth fill duration when motion is allowed", () => {
      const preset = resolveMotionPreset("path-fill", false);
      expect(preset.transition).toEqual({ duration: MOTION_DURATIONS.pathFill, ease: "easeOut" });
    });

    it("uses a shorter linear fill when reduced motion is requested", () => {
      const preset = resolveMotionPreset("path-fill", true);
      expect(preset.transition).toEqual({
        duration: MOTION_DURATIONS.pathFillReduced,
        ease: "linear",
      });
    });
  });
});
