import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSessionRoomSelection,
  effectiveRoomSelection,
  getSessionRoomSelection,
  saveSessionRoomSelection,
} from "@/features/reservations/selection-session";

describe("session room selection", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("keeps only valid dates, a positive guest target, and deduplicated room occupancy for the active browser session", () => {
    saveSessionRoomSelection({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      guests: 2,
      rooms: [
        { guestCount: 1, roomId: "valle" },
        { guestCount: 1, roomId: "andes" },
        { guestCount: 2, roomId: "valle" },
      ],
    });

    expect(getSessionRoomSelection()).toEqual({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      guests: 2,
      rooms: [
        { guestCount: 2, roomId: "valle" },
        { guestCount: 1, roomId: "andes" },
      ],
    });
    expect(
      window.sessionStorage.getItem("vista-valle.public-room-selection.v2")
    ).not.toContain("email");
  });

  it("does not interpret a v1 (room-id-array) entry as a valid selection", () => {
    window.sessionStorage.setItem(
      "vista-valle.public-room-selection.v1",
      JSON.stringify({
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        rooms: ["valle"],
      })
    );

    expect(getSessionRoomSelection()).toBeNull();
  });

  it("uses the stored selection only when the URL does not provide one for the same dates", () => {
    saveSessionRoomSelection({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      guests: 1,
      rooms: [{ guestCount: 1, roomId: "valle" }],
    });

    expect(
      effectiveRoomSelection(
        new URLSearchParams("checkIn=2026-10-05&checkOut=2026-10-07")
      )
    ).toEqual({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      guests: 1,
      rooms: [{ guestCount: 1, roomId: "valle" }],
    });
    expect(
      effectiveRoomSelection(
        new URLSearchParams("checkIn=2026-10-08&checkOut=2026-10-10")
      )
    ).toEqual({
      checkIn: "2026-10-08",
      checkOut: "2026-10-10",
      guests: 1,
      rooms: [],
    });
  });

  it("decodes per-room occupancy from the URL's rooms parameter", () => {
    expect(
      effectiveRoomSelection(
        new URLSearchParams(
          "checkIn=2026-10-05&checkOut=2026-10-07&guests=2&rooms=doble:1,matrimonial:1"
        )
      )
    ).toEqual({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      guests: 2,
      rooms: [
        { guestCount: 1, roomId: "doble" },
        { guestCount: 1, roomId: "matrimonial" },
      ],
    });
  });

  it("clears the selection after a successful reservation", () => {
    saveSessionRoomSelection({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      guests: 1,
      rooms: [{ guestCount: 1, roomId: "valle" }],
    });
    clearSessionRoomSelection();
    expect(getSessionRoomSelection()).toBeNull();
  });
});
