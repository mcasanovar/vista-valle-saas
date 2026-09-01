"use client";

import {
  motion,
  useReducedMotion,
  useReducedMotionConfig,
  type Transition,
} from "framer-motion";
import type { ReactNode } from "react";

const revealTransition: Transition = {
  duration: 0.36,
  ease: [0.2, 0, 0, 1],
};

export function usePublicReducedMotion() {
  const systemPreference = useReducedMotion();
  const configuredPreference = useReducedMotionConfig();

  return configuredPreference ?? systemPreference;
}

export function Reveal({
  children,
  delay = 0,
}: Readonly<{
  children: ReactNode;
  delay?: number;
}>) {
  const shouldReduceMotion = usePublicReducedMotion();
  const animated = !shouldReduceMotion;

  return (
    <motion.div
      data-motion={animated ? "enabled" : "reduced"}
      initial={animated ? { opacity: 0, y: 20 } : false}
      animate={animated ? { opacity: 1, y: 0 } : undefined}
      transition={{ ...revealTransition, delay: animated ? delay : 0 }}
    >
      {children}
    </motion.div>
  );
}

export function InteractiveSurface({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const shouldReduceMotion = usePublicReducedMotion();
  const animated = !shouldReduceMotion;

  return (
    <motion.div
      data-motion={animated ? "enabled" : "reduced"}
      whileHover={animated ? { y: -4 } : undefined}
      whileTap={animated ? { scale: 0.98 } : undefined}
      transition={revealTransition}
    >
      {children}
    </motion.div>
  );
}
