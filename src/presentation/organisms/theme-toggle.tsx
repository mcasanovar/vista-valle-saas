"use client";

import { useSyncExternalStore } from "react";
import { Button, Icon } from "@/presentation/atoms";

const STORAGE_KEY = "vv-theme";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

// A beforeInteractive script may add the `dark` class before hydration, so
// the server snapshot must assume light mode to match the SSR output.
function getServerSnapshot() {
  return false;
}

function setDarkMode(next: boolean) {
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  } catch {
    // Private browsing or storage disabled: theme stays for this view only.
  }
  for (const listener of listeners) listener();
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      onClick={() => setDarkMode(!isDark)}
      className="vv-theme-toggle !border-border !bg-background hover:!bg-background active:!bg-background dark:!border-transparent dark:!bg-gold dark:!text-on-gold dark:hover:!bg-gold dark:active:!bg-gold"
    >
      <Icon decorative name={isDark ? "Sun" : "Moon"} />
    </Button>
  );
}
