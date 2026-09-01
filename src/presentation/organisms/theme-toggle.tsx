"use client";

import { useState } from "react";
import { Button, Icon } from "@/presentation/atoms";

const STORAGE_KEY = "vv-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark")
  );

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private browsing or storage disabled: theme stays for this view only.
    }
    setIsDark(next);
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      onClick={toggle}
      className="!border-primary/25 !bg-warm hover:!bg-warm active:!bg-warm dark:!border-transparent dark:!bg-gold dark:!text-on-gold dark:hover:!bg-gold dark:active:!bg-gold"
    >
      <Icon decorative name={isDark ? "Sun" : "Moon"} />
    </Button>
  );
}
