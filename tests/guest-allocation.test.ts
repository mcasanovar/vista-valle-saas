import { describe, expect, it } from "vitest";

import {
  computeGuestAllocation,
  describeGuestAllocation,
  isOccupancySelectable,
  remainingGuestsExcludingRoom,
} from "@/features/reservations/guest-allocation";

describe("guest allocation", () => {
  it("marks the allocation complete once a single room covers the whole party", () => {
    const status = computeGuestAllocation(2, [
      { guestCount: 2, roomId: "doble" },
    ]);

    expect(status).toMatchObject({
      assignedGuests: 2,
      isComplete: true,
      remainingGuests: 0,
      targetGuests: 2,
    });
  });

  it("keeps other rooms selectable within the remaining headroom when split across two rooms", () => {
    const selections = [{ guestCount: 1, roomId: "doble" }];

    expect(remainingGuestsExcludingRoom(2, selections, "matrimonial")).toBe(1);
    expect(isOccupancySelectable(2, selections, "matrimonial", 1)).toBe(true);
    expect(isOccupancySelectable(2, selections, "matrimonial", 2)).toBe(false);
  });

  it("lets a selected room grow into its own full capacity without double-counting itself", () => {
    const selections = [{ guestCount: 1, roomId: "doble" }];

    expect(remainingGuestsExcludingRoom(2, selections, "doble")).toBe(2);
    expect(isOccupancySelectable(2, selections, "doble", 2)).toBe(true);
  });

  it("reports a clear, concise pending-allocation message", () => {
    const status = computeGuestAllocation(2, [
      { guestCount: 1, roomId: "doble" },
    ]);

    expect(describeGuestAllocation(status)).toBe(
      "Huéspedes asignados: 1 de 2. Falta 1 por asignar."
    );
  });

  it("reports a completed-allocation message", () => {
    const status = computeGuestAllocation(2, [
      { guestCount: 2, roomId: "doble" },
    ]);

    expect(describeGuestAllocation(status)).toBe(
      "Huéspedes asignados: 2 de 2. Reparto completo."
    );
  });
});
