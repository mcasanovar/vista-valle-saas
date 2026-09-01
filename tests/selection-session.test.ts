import { beforeEach, describe, expect, it } from "vitest";

import {
  clearSessionRoomSelection,
  effectiveRoomSelection,
  getSessionRoomSelection,
  saveSessionRoomSelection,
} from "@/features/reservations/selection-session";

describe("session room selection", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("keeps only valid dates and room identifiers for the active browser session", () => {
    saveSessionRoomSelection({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      rooms: ["valle", "andes", "valle"],
    });

    expect(getSessionRoomSelection()).toEqual({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      rooms: ["valle", "andes"],
    });
    expect(
      window.sessionStorage.getItem("vista-valle.public-room-selection.v1")
    ).not.toContain("email");
  });

  it("uses the stored selection only when the URL does not provide one for the same dates", () => {
    saveSessionRoomSelection({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      rooms: ["valle"],
    });

    expect(
      effectiveRoomSelection(
        new URLSearchParams("checkIn=2026-10-05&checkOut=2026-10-07")
      )
    ).toEqual({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      rooms: ["valle"],
    });
    expect(
      effectiveRoomSelection(
        new URLSearchParams("checkIn=2026-10-08&checkOut=2026-10-10")
      )
    ).toEqual({ checkIn: "2026-10-08", checkOut: "2026-10-10", rooms: [] });
  });

  it("clears the selection after a successful reservation", () => {
    saveSessionRoomSelection({
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      rooms: ["valle"],
    });
    clearSessionRoomSelection();
    expect(getSessionRoomSelection()).toBeNull();
  });
});
