"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { resolveMotionPreset } from "@/lib/motion";
import { cn } from "./cn";

export type MascotState = "idle" | "happy" | "celebrate" | "encourage";
export type MascotRegister = "kid" | "adult";

const BOX: Record<MascotRegister, number> = {
  kid: 128,
  adult: 72,
};

const STATE_LABELS: Record<MascotState, string> = {
  idle: "Companion resting",
  happy: "Companion happy",
  celebrate: "Companion celebrating",
  encourage: "Companion encouraging you",
};

export type MascotProps = Omit<React.ComponentProps<"div">, "children"> & {
  state: MascotState;
  register?: MascotRegister;
};

function stateMotion(
  state: MascotState,
  reducedMotion: boolean,
): {
  initial: { opacity: number; scale?: number; y?: number; rotate?: number };
  animate: {
    opacity: number;
    scale?: number | number[];
    y?: number | number[];
    rotate?: number | number[];
  };
  transition: ReturnType<typeof resolveMotionPreset>["transition"];
} {
  const enter = resolveMotionPreset("enter", reducedMotion);
  const celebrate = resolveMotionPreset("celebrate", reducedMotion);

  if (reducedMotion) {
    return {
      initial: enter.initial,
      animate: enter.animate,
      transition: enter.transition,
    };
  }

  switch (state) {
    case "idle":
      return {
        initial: enter.initial,
        animate: { ...enter.animate, y: [0, -5, 0] },
        transition: { ...enter.transition, repeat: Infinity, duration: 2.8, ease: "easeInOut" },
      };
    case "happy":
      return {
        initial: celebrate.initial,
        animate: { opacity: 1, scale: [1, 1.04, 1] },
        transition: { duration: 0.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 1.2 },
      };
    case "celebrate":
      return {
        initial: celebrate.initial,
        animate: { ...celebrate.animate, rotate: [0, -4, 4, -2, 0] },
        transition: { ...celebrate.transition, repeat: Infinity, repeatDelay: 1.5 },
      };
    case "encourage":
      return {
        initial: enter.initial,
        animate: { opacity: 1, y: [0, -3, 0, -2, 0] },
        transition: { duration: 1.4, ease: "easeInOut", repeat: Infinity },
      };
  }
}

type MascotArtProps = {
  state: MascotState;
  register: MascotRegister;
};

/**
 * Inline SVG art — the only place mascot visuals live. Feature code imports `Mascot`, never
 * assets directly, so static art can be swapped for animation later without touching callers.
 */
function MascotArt({ state, register }: MascotArtProps) {
  const kid = register === "kid";
  const stroke = kid ? 3 : 2;
  const eyeR = kid ? 9 : 5;
  const pupilR = kid ? 4 : 2.5;
  const eyeY = kid ? 46 : 30;
  const eyeOffsetX = kid ? 14 : 8;

  return (
    <svg viewBox="0 0 96 96" className="h-full w-full" aria-hidden="true" focusable="false">
      {/* Soft halo — reads on dark and bright palettes via accent token */}
      <circle
        cx="48"
        cy="50"
        r={kid ? 38 : 34}
        className="fill-accent/15 stroke-accent/25"
        strokeWidth={stroke}
      />

      {/* Body */}
      <ellipse
        cx="48"
        cy="54"
        rx={kid ? 30 : 26}
        ry={kid ? 28 : 24}
        className="fill-card stroke-foreground"
        strokeWidth={stroke}
      />

      {/* Ear tufts */}
      <path
        d={
          kid
            ? "M28 30 L22 14 L36 24 Z M68 30 L74 14 L60 24 Z"
            : "M32 34 L28 22 L40 30 Z M64 34 L68 22 L56 30 Z"
        }
        className="fill-accent stroke-foreground"
        strokeWidth={stroke}
        strokeLinejoin="round"
      />

      {/* Eyes — white sclera for contrast on all palettes */}
      <circle
        cx={48 - eyeOffsetX}
        cy={eyeY}
        r={eyeR}
        className="fill-background stroke-foreground"
        strokeWidth={stroke}
      />
      <circle
        cx={48 + eyeOffsetX}
        cy={eyeY}
        r={eyeR}
        className="fill-background stroke-foreground"
        strokeWidth={stroke}
      />

      {/* Pupils shift per state */}
      <circle
        cx={48 - eyeOffsetX + (state === "encourage" ? 1 : 0)}
        cy={
          eyeY + (state === "happy" || state === "celebrate" ? -1 : state === "encourage" ? 1 : 0)
        }
        r={pupilR}
        className="fill-foreground"
      />
      <circle
        cx={48 + eyeOffsetX + (state === "encourage" ? 1 : 0)}
        cy={
          eyeY + (state === "happy" || state === "celebrate" ? -1 : state === "encourage" ? 1 : 0)
        }
        r={pupilR}
        className="fill-foreground"
      />

      {/* Happy / celebrate cheek blush */}
      {(state === "happy" || state === "celebrate") && (
        <>
          <ellipse cx="30" cy="58" rx={kid ? 6 : 4} ry={kid ? 3 : 2} className="fill-accent/35" />
          <ellipse cx="66" cy="58" rx={kid ? 6 : 4} ry={kid ? 3 : 2} className="fill-accent/35" />
        </>
      )}

      {/* Beak */}
      <path
        d="M48 56 L42 64 L54 64 Z"
        className="fill-warning stroke-foreground"
        strokeWidth={stroke}
        strokeLinejoin="round"
      />

      {/* Mouth / expression */}
      {state === "idle" && (
        <path
          d="M40 68 Q48 72 56 68"
          fill="none"
          className="stroke-foreground"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      )}
      {state === "happy" && (
        <path
          d="M38 66 Q48 76 58 66"
          fill="none"
          className="stroke-foreground"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      )}
      {state === "celebrate" && (
        <path
          d="M36 64 Q48 78 60 64"
          fill="none"
          className="stroke-foreground"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      )}
      {state === "encourage" && (
        <>
          <path
            d="M40 68 Q48 72 56 68"
            fill="none"
            className="stroke-foreground"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          {/* Thumbs-up wing */}
          <path
            d={kid ? "M68 52 L78 40 L82 44 L74 56 Z" : "M66 50 L74 42 L76 45 L70 54 Z"}
            className="fill-accent stroke-foreground"
            strokeWidth={stroke}
            strokeLinejoin="round"
          />
        </>
      )}

      {/* Celebrate sparkles — kid register only for restraint in adult mode */}
      {state === "celebrate" && (
        <>
          <path
            d="M18 28 L20 22 L22 28 L28 30 L22 32 L20 38 L18 32 L12 30 Z"
            className="fill-accent stroke-foreground"
            strokeWidth={kid ? 1.5 : 1}
            strokeLinejoin="round"
          />
          <path
            d="M76 20 L77.5 16 L79 20 L83 21.5 L79 23 L77.5 27 L76 23 L72 21.5 Z"
            className="fill-warning stroke-foreground"
            strokeWidth={kid ? 1.5 : 1}
            strokeLinejoin="round"
          />
          {kid ? (
            <path
              d="M80 72 L81.5 68 L83 72 L87 73.5 L83 75 L81.5 79 L80 75 L76 73.5 Z"
              className="fill-accent stroke-foreground"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          ) : null}
        </>
      )}

      {/* Wing detail */}
      <path
        d={kid ? "M22 58 Q16 68 22 78 Q28 72 26 64 Z" : "M26 56 Q22 64 26 72 Q30 68 28 62 Z"}
        className="fill-accent/40 stroke-foreground"
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Learning companion — expressive in kid mode, compact in adult mode. */
export function Mascot({ state, register = "kid", className, ...props }: MascotProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const box = BOX[register];
  const motionProps = stateMotion(state, reducedMotion);

  return (
    <div
      role="img"
      aria-label={STATE_LABELS[state]}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: box, height: box }}
      {...props}
    >
      <motion.div
        key={state}
        className="h-full w-full"
        initial={motionProps.initial}
        animate={motionProps.animate}
        transition={motionProps.transition}
      >
        <MascotArt state={state} register={register} />
      </motion.div>
    </div>
  );
}
