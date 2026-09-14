/**
 * Pure "guest allocation" rules shared by results, room detail, and the
 * cart (see `availability-search-experience` spec, "Reparto de huéspedes
 * entre habitaciones seleccionadas"). None of this touches persistence or
 * the authoritative price - it only decides what the visitor is allowed to
 * pick next, given how many guests they've already assigned to other
 * selected rooms for the same search.
 */

import type { RoomOccupancySelection } from "@/features/reservations/room-selection-codec";

export type GuestAllocationStatus = Readonly<{
  assignedGuests: number;
  isComplete: boolean;
  remainingGuests: number;
  targetGuests: number;
}>;

/** Total guests assigned across every selected room, vs. the target searched. */
export function computeGuestAllocation(
  targetGuests: number,
  selections: readonly RoomOccupancySelection[]
): GuestAllocationStatus {
  const assignedGuests = selections.reduce(
    (sum, selection) => sum + selection.guestCount,
    0
  );

  return Object.freeze({
    assignedGuests,
    isComplete: assignedGuests >= targetGuests,
    remainingGuests: Math.max(targetGuests - assignedGuests, 0),
    targetGuests,
  });
}

/**
 * Guests still available to assign, ignoring `roomId`'s own current
 * selection - what that room itself is allowed to grow into without
 * exceeding the target.
 */
export function remainingGuestsExcludingRoom(
  targetGuests: number,
  selections: readonly RoomOccupancySelection[],
  roomId: string
): number {
  const assignedElsewhere = selections
    .filter((selection) => selection.roomId !== roomId)
    .reduce((sum, selection) => sum + selection.guestCount, 0);

  return Math.max(targetGuests - assignedElsewhere, 0);
}

/** Whether choosing `candidateGuestCount` for `roomId` would keep the total within the target. */
export function isOccupancySelectable(
  targetGuests: number,
  selections: readonly RoomOccupancySelection[],
  roomId: string,
  candidateGuestCount: number
): boolean {
  return (
    candidateGuestCount <=
    remainingGuestsExcludingRoom(targetGuests, selections, roomId)
  );
}

/** Clear, concise Spanish copy for the current allocation status. */
export function describeGuestAllocation(status: GuestAllocationStatus): string {
  if (status.isComplete) {
    return `Huéspedes asignados: ${status.assignedGuests} de ${status.targetGuests}. Reparto completo.`;
  }

  const missing = status.remainingGuests;
  return `Huéspedes asignados: ${status.assignedGuests} de ${status.targetGuests}. Falta${missing === 1 ? "" : "n"} ${missing} por asignar.`;
}
