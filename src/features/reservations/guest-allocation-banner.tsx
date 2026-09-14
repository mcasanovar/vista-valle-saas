"use client";

import { useSearchParams } from "next/navigation";
import {
  effectiveRoomSelection,
  useSessionRoomSelection,
} from "./selection-session";
import { computeGuestAllocation, describeGuestAllocation } from "./guest-allocation";

/**
 * Clear, concise "huéspedes asignados: X de Y" status for the availability
 * results page - see `availability-search-experience` spec, "Reparto de
 * huéspedes entre habitaciones seleccionadas". Renders nothing until at
 * least one room has been added, so a single-room search stays uncluttered.
 */
export function GuestAllocationBanner() {
  const searchParams = useSearchParams();
  const storedSelection = useSessionRoomSelection();
  const selection = effectiveRoomSelection(
    new URLSearchParams(searchParams?.toString() ?? ""),
    storedSelection
  );
  if (!selection?.rooms.length) return null;

  const allocation = computeGuestAllocation(selection.guests, selection.rooms);

  return (
    <p role="status" className="text-sm font-medium text-foreground">
      {describeGuestAllocation(allocation)}
    </p>
  );
}
