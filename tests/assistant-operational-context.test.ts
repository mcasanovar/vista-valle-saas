import { describe, expect, it } from "vitest";

import { createRoomReadSource, type RoomReadModel } from "@/features/rooms";
import { buildAssistantOperationalContext } from "@/features/assistant/operational-context";

function room(overrides: Partial<RoomReadModel> = {}): RoomReadModel {
  return Object.freeze({
    active: true,
    amenities: ["wifi"],
    bathroom: "privado",
    bedConfiguration: "1 cama queen",
    capacity: 2,
    description: "Habitación de prueba",
    id: "room-1",
    images: [{ alt: "Vista de la habitación", id: "img-1", src: "/room.jpg" }],
    isDemonstration: false,
    name: "Habitación Andes",
    nightlyPriceClp: 50_000,
    occupancyPrices: [],
    slug: "andes",
    ...overrides,
  });
}

describe("assistant operational context", () => {
  it("reflects the rooms currently in the data source, without a fixed list", async () => {
    const source = createRoomReadSource("mock", [room()]);

    const context = await buildAssistantOperationalContext(
      source,
      new Date("2030-06-15T12:00:00Z")
    );

    expect(context.rooms).toEqual([
      { capacity: 2, id: "room-1", name: "Habitación Andes", nightlyPriceClp: 50_000 },
    ]);
  });

  it("shows a newly added room without any code or manual change", async () => {
    const before = createRoomReadSource("mock", [room()]);
    const beforeContext = await buildAssistantOperationalContext(before);
    expect(beforeContext.rooms).toHaveLength(1);

    const after = createRoomReadSource("mock", [
      room(),
      room({ id: "room-2", name: "Habitación Valle", slug: "valle" }),
    ]);
    const afterContext = await buildAssistantOperationalContext(after);

    expect(afterContext.rooms).toHaveLength(2);
    expect(afterContext.rooms.map((r) => r.id)).toContain("room-2");
  });

  it("computes today's date in America/Santiago, day granularity only", async () => {
    const source = createRoomReadSource("mock", [room()]);

    const context = await buildAssistantOperationalContext(
      source,
      new Date("2030-06-15T02:30:00Z")
    );

    expect(context.today).toBe("2030-06-14");
  });

  it("exposes the valid manual origins, reservation transitions and block statuses", async () => {
    const source = createRoomReadSource("mock", [room()]);
    const context = await buildAssistantOperationalContext(source);

    expect(context.validManualOrigins).toContain("phone");
    expect(context.validReservationStatusTransitions).toEqual([
      "cancelled",
      "completed",
      "no_show",
    ]);
    expect(context.validRoomBlockStatuses).toContain("active");
  });
});
