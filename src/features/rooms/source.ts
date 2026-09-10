import "server-only";

import { getServerEnvironment } from "@/config/server";
import { queryProductionRooms } from "@/infrastructure/database/room-source";
import { mockDemoRooms } from "./mock-fixtures";
import { createRoomReadSource } from "./read-model";
import { getCanonicalMockRoomPricingRepository } from "./room-pricing-admin";

/** Layers any admin-saved mock tariff override onto the static demo fixtures, so `/admin/habitaciones/[roomId]/tarifas` is reflected in the public mock site immediately (see `admin-room-pricing` spec). */
function withMockPricingOverrides(rooms: typeof mockDemoRooms) {
  const repository = getCanonicalMockRoomPricingRepository();
  return rooms.map((room) => {
    const override = repository.overrideFor(room.id);
    if (!override) return room;
    return Object.freeze({
      ...room,
      occupancyPrices: Object.freeze([
        Object.freeze({ occupancy: 1, priceClp: override.priceOneGuestClp }),
        ...(room.capacity > 1
          ? [
              Object.freeze({
                occupancy: 2,
                priceClp: override.priceTwoGuestsClp,
              }),
            ]
          : []),
      ]),
    });
  });
}

export async function getRoomReadSource() {
  const context = getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT;
  const records =
    context === "mock"
      ? withMockPricingOverrides(mockDemoRooms)
      : await queryProductionRooms();
  return createRoomReadSource(context, records);
}
