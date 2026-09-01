"use client";

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Shared motion tokens (task 6.1) - one rhythm across the calendar's transitions. */
export const calendarMotionTokens = Object.freeze({
  detailPanelSpring: Object.freeze({
    damping: 28,
    stiffness: 320,
    type: "spring" as const,
  }),
  itemDuration: 0.28,
  itemStagger: 0.025,
  rangeDuration: 0.26,
  rangeEase: [0.22, 1, 0.36, 1] as const,
});

/**
 * Direction-aware slide + crossfade between calendar ranges (spec:
 * "Navegación entre rangos"). Deriving the direction from a prop change via
 * `useState` (not a ref) during render is React's sanctioned pattern for
 * this ("Adjusting state when a prop changes" in the React docs) - it
 * updates state synchronously in the same render pass instead of after
 * paint, so no ref access happens during render (see design.md decision
 * "Animación").
 */
export function CalendarRangeTransition({
  rangeKey,
  children,
}: Readonly<{ rangeKey: string; children: ReactNode }>) {
  const reducedMotion = useReducedMotion();
  const [previousKey, setPreviousKey] = useState(rangeKey);
  const [direction, setDirection] = useState(0);
  if (rangeKey !== previousKey) {
    setDirection(rangeKey > previousKey ? 1 : -1);
    setPreviousKey(rangeKey);
  }

  if (reducedMotion) return <>{children}</>;

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={rangeKey}
        initial={{ opacity: 0, x: direction * 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direction * -24 }}
        transition={{
          duration: calendarMotionTokens.rangeDuration,
          ease: calendarMotionTokens.rangeEase,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: calendarMotionTokens.itemStagger },
  },
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    transition: { duration: calendarMotionTokens.itemDuration },
    y: 0,
  },
};

/** Subtle, no-overshoot entrance for calendar bars/agenda rows (task 6.1 - "sin back.out"). */
export function CalendarStaggerGroup({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      animate="visible"
      className={className}
      initial="hidden"
      variants={staggerContainerVariants}
    >
      {children}
    </motion.div>
  );
}

export function CalendarStaggerItem({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={staggerItemVariants}>
      {children}
    </motion.div>
  );
}

/** Sheet that enters from `origin` (spec: "Panel de detalle... spring desde el origen del tap/clic"). */
export function CalendarDetailSheet({
  children,
  onClose,
  origin = "right",
}: Readonly<{
  children: ReactNode;
  onClose: () => void;
  origin?: "right" | "bottom";
}>) {
  const reducedMotion = useReducedMotion();
  const offscreen =
    origin === "right" ? { x: "100%" } : { y: "100%" };
  const onscreen = origin === "right" ? { x: 0 } : { y: 0 };
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current
      ?.querySelector<HTMLElement>("button, a[href]")
      ?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <motion.button
        animate={{ opacity: 1 }}
        aria-label="Cerrar panel de detalle"
        className="absolute inset-0 bg-black/30"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onClose}
        transition={reducedMotion ? { duration: 0 } : undefined}
        type="button"
      />
      <motion.div
        animate={onscreen}
        aria-modal="true"
        className="relative h-full w-full max-w-sm overflow-y-auto bg-card p-5 shadow-xl tablet:w-96"
        exit={offscreen}
        initial={reducedMotion ? onscreen : offscreen}
        ref={panelRef}
        role="dialog"
        transition={
          reducedMotion
            ? { duration: 0 }
            : calendarMotionTokens.detailPanelSpring
        }
      >
        {children}
      </motion.div>
    </div>
  );
}
