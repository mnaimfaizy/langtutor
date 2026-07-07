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

/**
 * Prop names where Base UI's `ComponentProps` and framer-motion's `HTMLMotionProps` disagree,
 * so any `ui/` component that wraps a Base UI primitive with `motion.create()` and re-exports
 * that primitive's `ComponentProps` must omit them — otherwise the two signatures fail to
 * unify when spread onto the motion-wrapped element:
 *
 * - `onAnimationStart` / `onDrag` / `onDragStart` / `onDragEnd`: Base UI forwards these as
 *   native (or `BaseUIEvent`-wrapped) DOM events; framer-motion redefines them to receive its
 *   own gesture/animation types (`PanInfo`, `AnimationDefinition`) instead.
 * - `style`: Base UI lets `style` be a function of internal render state (e.g.
 *   `(state) => CSSProperties`); framer-motion's `MotionStyle` only accepts a plain object.
 *   None of our `ui/` components currently need the function form, so it's dropped here.
 */
export type MotionUnsafeProp =
  | "onAnimationStart"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "style";
