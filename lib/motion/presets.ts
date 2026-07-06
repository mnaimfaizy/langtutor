import type {
  CelebrateMotionPreset,
  EnterMotionPreset,
  MotionPreset,
  MotionPresetName,
  PathFillMotionPreset,
  PressMotionPreset,
} from "./types";

/** Single source of truth for motion durations (seconds). */
export const MOTION_DURATIONS = {
  enter: 0.15,
  enterReduced: 0.1,
  press: 0.1,
  pressReduced: 0.05,
  celebrate: 0.5,
  celebrateReduced: 0.2,
  pathFill: 0.4,
  pathFillReduced: 0.15,
} as const;

/** Single source of truth for motion easing curves. */
export const MOTION_EASING = {
  enter: "easeInOut",
  press: "easeOut",
  celebrate: [0.34, 1.56, 0.64, 1] as const,
  pathFill: "easeOut",
  pathFillReduced: "linear",
} as const;

function enterPreset(reducedMotion: boolean): EnterMotionPreset {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: MOTION_DURATIONS.enterReduced, ease: MOTION_EASING.enter },
    };
  }

  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: MOTION_DURATIONS.enter, ease: MOTION_EASING.enter },
  };
}

function pressPreset(reducedMotion: boolean): PressMotionPreset {
  if (reducedMotion) {
    return {
      whileTap: { opacity: 0.88 },
      transition: { duration: MOTION_DURATIONS.pressReduced, ease: MOTION_EASING.press },
    };
  }

  return {
    whileTap: { scale: 0.97 },
    transition: { duration: MOTION_DURATIONS.press, ease: MOTION_EASING.press },
  };
}

function celebratePreset(reducedMotion: boolean): CelebrateMotionPreset {
  if (reducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: MOTION_DURATIONS.celebrateReduced, ease: MOTION_EASING.enter },
    };
  }

  return {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: MOTION_DURATIONS.celebrate, ease: MOTION_EASING.celebrate },
  };
}

function pathFillPreset(reducedMotion: boolean): PathFillMotionPreset {
  return {
    transition: {
      duration: reducedMotion ? MOTION_DURATIONS.pathFillReduced : MOTION_DURATIONS.pathFill,
      ease: reducedMotion ? MOTION_EASING.pathFillReduced : MOTION_EASING.pathFill,
    },
  };
}

const presetResolvers: Record<MotionPresetName, (reducedMotion: boolean) => MotionPreset> = {
  enter: enterPreset,
  press: pressPreset,
  celebrate: celebratePreset,
  "path-fill": pathFillPreset,
};

export function resolveMotionPreset(name: "enter", reducedMotion: boolean): EnterMotionPreset;
export function resolveMotionPreset(name: "press", reducedMotion: boolean): PressMotionPreset;
export function resolveMotionPreset(
  name: "celebrate",
  reducedMotion: boolean,
): CelebrateMotionPreset;
export function resolveMotionPreset(
  name: "path-fill",
  reducedMotion: boolean,
): PathFillMotionPreset;
export function resolveMotionPreset(name: MotionPresetName, reducedMotion: boolean): MotionPreset;
export function resolveMotionPreset(name: MotionPresetName, reducedMotion: boolean): MotionPreset {
  return presetResolvers[name](reducedMotion);
}
