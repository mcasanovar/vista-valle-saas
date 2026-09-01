"use client";

import { useRouter } from "next/navigation";

/**
 * Prefers browser history (so list filters/pagination survive the trip)
 * and falls back to `fallbackHref` when there is no in-app history to
 * return to (e.g. the detail page was opened directly).
 */
export function AdminBackLink({
  fallbackHref,
  label = "Volver",
}: Readonly<{ fallbackHref: string; label?: string }>) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
    >
      ← {label}
    </button>
  );
}
