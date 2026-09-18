"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";
import type { ChannelPlatform, ChannelPlatformPauseState } from "./connections";

const platformLabel: Record<ChannelPlatform, string> = {
  airbnb: "Airbnb",
  booking: "Booking",
};

/**
 * Two independent switches — one per platform — that pause/resume both the
 * inbound polling and the outbound feed for every connection of that
 * platform, without touching any connection's own `enabled` value (design.md
 * decision 2 of "allow-full-reservation-editing-and-ota-sync-toggle").
 */
export function PlatformPauseToggles({
  setPaused,
  states,
}: Readonly<{
  setPaused: (data: FormData) => Promise<unknown>;
  states: readonly ChannelPlatformPauseState[];
}>) {
  const router = useRouter();
  const { notify } = useToast();
  const [pendingPlatform, setPendingPlatform] = useState<ChannelPlatform>();

  const toggle = async (platform: ChannelPlatform, nextPaused: boolean) => {
    setPendingPlatform(platform);
    try {
      const data = new FormData();
      data.set("platform", platform);
      data.set("paused", String(nextPaused));
      await setPaused(data);
      notify(
        "success",
        nextPaused
          ? `${platformLabel[platform]} pausado.`
          : `${platformLabel[platform]} reanudado.`
      );
      router.refresh();
    } catch {
      notify(
        "error",
        `No pudimos ${nextPaused ? "pausar" : "reanudar"} ${platformLabel[platform]}.`
      );
    } finally {
      setPendingPlatform(undefined);
    }
  };

  return (
    <section
      aria-labelledby="platform-pause-title"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <h2 id="platform-pause-title" className="font-heading text-lg text-foreground">
        Pausar sincronización por plataforma
      </h2>
      <p className="text-sm text-muted-foreground">
        Detiene, para la plataforma elegida, tanto la llegada de reservas
        nuevas como el calendario que esa plataforma consulta para bloquear
        fechas — sin perder la configuración de cada conexión.
      </p>
      <div className="flex flex-wrap gap-3">
        {states.map((state) => (
          <div
            key={state.platform}
            className="flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <span className="font-semibold text-foreground">
              {platformLabel[state.platform]}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                state.paused
                  ? "bg-destructive/15 text-destructive"
                  : "bg-[var(--admin-reservation-confirmed-background)] text-[var(--admin-reservation-confirmed)]"
              }`}
            >
              {state.paused ? "⏸ Pausado" : "● Sincronizando"}
            </span>
            <Button
              type="button"
              variant="secondary"
              loading={pendingPlatform === state.platform}
              onClick={() => void toggle(state.platform, !state.paused)}
            >
              {state.paused ? "Reanudar" : "Pausar"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
