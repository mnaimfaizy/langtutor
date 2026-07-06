import type { Transition } from "framer-motion";

export const MOTION_PRESET_NAMES = ["enter", "press", "celebrate", "path-fill"] as const;

export type MotionPresetName = (typeof MOTION_PRESET_NAMES)[number];

export type EnterMotionPreset = {
  initial: { opacity: number; y?: number };
  animate: { opacity: number; y?: number };
  exit: { opacity: number; y?: number };
  transition: Transition;
};

export type PressMotionPreset = {
  whileTap: { scale?: number; opacity?: number };
  transition: Transition;
};

export type CelebrateMotionPreset = {
  initial: { opacity: number; scale?: number };
  animate: { opacity: number; scale?: number };
  transition: Transition;
};

export type PathFillMotionPreset = {
  transition: Transition;
};

export type MotionPreset =
  | EnterMotionPreset
  | PressMotionPreset
  | CelebrateMotionPreset
  | PathFillMotionPreset;
