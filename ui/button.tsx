"use client";

import * as React from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import { motion, useReducedMotion } from "framer-motion";
import { resolveMotionPreset } from "@/lib/motion";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./button-styles";

export type { ButtonSize, ButtonVariant };

const MotionButton = motion.create(BaseButton);

export type ButtonProps = Omit<React.ComponentProps<typeof BaseButton>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function Button({ variant, size, className, ...props }: ButtonProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const press = resolveMotionPreset("press", reducedMotion);

  return (
    <MotionButton
      className={buttonClassName({ variant, size, className })}
      whileTap={press.whileTap}
      transition={press.transition}
      {...props}
    />
  );
}
