"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Price } from "@/presentation/molecules";
import {
  effectiveRoomSelection,
  saveSessionRoomSelection,
  useSessionRoomSelection,
} from "./selection-session";
import { isOccupancySelectable } from "./guest-allocation";
import { RoomDetailSelectionButton } from "./room-detail-selection-button";
// Deep import (not the `@/features/rooms` barrel) so this client component
// never pulls in `source.ts`'s `import "server-only"` guard.
// eslint-disable-next-line architecture/feature-public-api
import { resolveDisplayRoomNightlyPrice } from "@/features/rooms/occupancy-pricing";
// eslint-disable-next-line architecture/feature-public-api
import type { RoomOccupancyPrice } from "@/features/rooms/read-model";

const selectableOccupancies = [1, 2] as const;

export function RoomDetailPriceCard({
  slug,
  capacity,
  nightlyPriceClp,
  occupancyPrices,
}: Readonly<{
  slug: string;
  capacity: number;
  nightlyPriceClp: number;
  occupancyPrices: readonly RoomOccupancyPrice[];
}>) {
  const searchParams = useSearchParams();
  const storedSelection = useSessionRoomSelection();
  const selection = effectiveRoomSelection(
    new URLSearchParams(searchParams?.toString() ?? ""),
    storedSelection
  );
  const existingEntry = selection?.rooms.find((room) => room.roomId === slug);
  const hasOccupancyChoice = capacity > 1;
  const [pendingOccupancy, setPendingOccupancy] = useState<number | null>(
    hasOccupancyChoice ? null : 1
  );
  const occupancy = existingEntry
    ? existingEntry.guestCount
    : pendingOccupancy;

  const chooseOccupancy = (nextOccupancy: number) => {
    if (existingEntry && selection) {
      saveSessionRoomSelection({
        ...selection,
        rooms: selection.rooms.map((room) =>
          room.roomId === slug ? { ...room, guestCount: nextOccupancy } : room
        ),
      });
    } else {
      setPendingOccupancy(nextOccupancy);
    }
  };
  const displayedPrice =
    occupancy !== null
      ? resolveDisplayRoomNightlyPrice(
          { capacity, nightlyPriceClp },
          occupancyPrices,
          occupancy
        )
      : Math.min(
          nightlyPriceClp,
          ...occupancyPrices.map((entry) => entry.priceClp)
        );

  return (
    <div className="space-y-4">
      {hasOccupancyChoice ? (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Personas en esta habitación
          </span>
          <div
            role="group"
            aria-label="Cantidad de personas"
            className="inline-flex rounded-full border border-border bg-muted p-1"
          >
            {selectableOccupancies
              .filter((value) => value <= capacity)
              .map((value) => {
                const disabled =
                  selection !== null &&
                  !isOccupancySelectable(
                    selection.guests,
                    selection.rooms,
                    slug,
                    value
                  );
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={occupancy === value}
                    disabled={disabled}
                    onClick={() => chooseOccupancy(value)}
                    className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors ${
                      occupancy === value
                        ? "bg-foreground text-background"
                        : "text-muted-foreground"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {value} {value === 1 ? "persona" : "personas"}
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}
      <Price
        amount={displayedPrice}
        label={capacity === 1 || occupancy === null ? "Desde" : ""}
        suffix="CLP / noche"
      />
      <RoomDetailSelectionButton
        slug={slug}
        guestCount={occupancy ?? 1}
        disabled={hasOccupancyChoice && occupancy === null}
      />
    </div>
  );
}
