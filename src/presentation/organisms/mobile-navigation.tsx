"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
  const root = useRef<HTMLDivElement>(null);
  const controlsId = `mobile-navigation-${useId().replace(/:/g, "")}`;
  const close = () => setOpen(false);
  const closeAndFocus = () => {
    close();
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.querySelector<HTMLElement>("a[href]")?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocus();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = root.current?.querySelectorAll<HTMLElement>(
      "button, a[href]"
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={root}
      className="relative laptop:hidden"
      onKeyDown={handleKeyDown}
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
            className="fixed right-4 top-[5.25rem] z-40 box-border max-h-[calc(100dvh-6rem)] w-[min(20rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border bg-card p-3 shadow-md"
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
