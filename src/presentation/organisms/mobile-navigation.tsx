"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useId, useRef, useState } from "react";
import { ActionLink, Button, Icon } from "@/presentation/atoms";
import type { PublicNavigationItem } from "./public-header";
import { usePublicReducedMotion } from "./motion";

export function MobileNavigation({
  items,
}: {
  items: readonly PublicNavigationItem[];
}) {
  const [open, setOpen] = useState(false);
  const shouldReduceMotion = usePublicReducedMotion();
  const animated = !shouldReduceMotion;
  const trigger = useRef<HTMLButtonElement>(null);
  const controlsId = `mobile-navigation-${useId().replace(/:/g, "")}`;
  const close = () => setOpen(false);
  const closeAndFocus = () => {
    close();
    trigger.current?.focus();
  };
  return (
    <div
      className="relative laptop:hidden"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          closeAndFocus();
        }
      }}
    >
      <Button
        ref={trigger}
        size="icon"
        variant="secondary"
        aria-label={open ? "Cerrar navegación" : "Abrir navegación"}
        aria-controls={controlsId}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon decorative name={open ? "X" : "Menu"} />
      </Button>
      <AnimatePresence initial={animated}>
        {open && (
          <motion.nav
            id={controlsId}
            aria-label="Navegación móvil"
            data-motion={animated ? "enabled" : "reduced"}
            initial={animated ? { opacity: 0, y: -8 } : false}
            animate={animated ? { opacity: 1, y: 0 } : undefined}
            exit={animated ? { opacity: 0, y: -8 } : undefined}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="absolute right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border bg-card p-3 shadow-md"
          >
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.href}>
                  <ActionLink
                    href={item.href}
                    className="flex min-h-11 w-full items-center"
                    onClick={close}
                  >
                    {item.label}
                  </ActionLink>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
