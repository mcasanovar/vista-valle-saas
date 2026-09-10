/**
 * Pure encode/decode helpers for the `rooms` URL parameter and the
 * sessionStorage cart, shared by client selection state
 * (`selection-session.ts`) and server-only composition (`prebooking-review.ts`).
 * Deliberately has no "use client" directive so both boundaries can import
 * it directly - see `date-only.ts` for the same pattern.
 *
 * Encoding: `"<roomId>:<guestCount>"` entries joined by `,` (e.g.
 * `"doble:2,matrimonial:1"`). A bare `<roomId>` with no `:<guestCount>`
 * (the pre-occupancy URL shape) defaults to a guest count of 1.
 */

export type RoomOccupancySelection = Readonly<{
  roomId: string;
  guestCount: number;
}>;

export function parseRoomSelectionParam(
  raw: string | null | undefined
): readonly RoomOccupancySelection[] {
  if (!raw) return [];

  const byRoomId = new Map<string, number>();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const [roomId, guestCountRaw] = trimmed.split(":");
    if (!roomId) continue;
    const guestCount = Number(guestCountRaw);
    byRoomId.set(
      roomId,
      Number.isSafeInteger(guestCount) && guestCount > 0 ? guestCount : 1
    );
  }

  return Object.freeze(
    [...byRoomId.entries()].map(([roomId, guestCount]) =>
      Object.freeze({ roomId, guestCount })
    )
  );
}

export function serializeRoomSelectionParam(
  selections: readonly RoomOccupancySelection[]
): string {
  return selections
    .map((selection) => `${selection.roomId}:${selection.guestCount}`)
    .join(",");
}
