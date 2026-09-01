export class GuestCapacityExceededError extends RangeError {
  readonly attemptedGuestCount: number;
  readonly code = "GUEST_CAPACITY_EXCEEDED" as const;
  readonly roomCapacity: number;

  constructor(attemptedGuestCount: number, roomCapacity: number) {
    super(
      `Requested guest count (${attemptedGuestCount}) exceeds the room capacity (${roomCapacity} guest${
        roomCapacity === 1 ? "" : "s"
      }).`
    );
    this.attemptedGuestCount = attemptedGuestCount;
    this.name = "GuestCapacityExceededError";
    this.roomCapacity = roomCapacity;
  }
}

/**
 * Server-authoritative capacity check. `guestCount` MUST come from
 * validated guest input (see `guest.ts`) and `roomCapacity` MUST come from
 * a trusted `RoomReadModel`, never from client-supplied values.
 */
export function assertGuestCountWithinCapacity(
  guestCount: number,
  roomCapacity: number
): void {
  if (!Number.isSafeInteger(guestCount) || guestCount <= 0) {
    throw new RangeError("Guest count must be a positive safe integer");
  }

  if (!Number.isSafeInteger(roomCapacity) || roomCapacity <= 0) {
    throw new RangeError("Room capacity must be a positive safe integer");
  }

  if (guestCount > roomCapacity) {
    throw new GuestCapacityExceededError(guestCount, roomCapacity);
  }
}
