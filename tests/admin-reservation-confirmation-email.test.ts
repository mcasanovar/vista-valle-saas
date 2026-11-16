import { describe, expect, it } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import { manualOrigins } from "@/features/admin/manual-reservation-contract";
import { createMockNotificationOutbox } from "@/features/notifications";
import { mockDemoRooms } from "@/features/rooms";
import { createMockGuestRepository } from "@/features/reservations/guest-repository";
import {
  createMultiRoomPayAtPropertyReservation,
  reservationOriginNotifiesOnConfirmation,
} from "@/features/reservations";
import { createMockReservationRepository } from "@/features/reservations/reservation-repository";

const guest = {
  email: "huesped.manual@example.test",
  firstName: "Ana",
  guestCount: 1,
  lastName: "Pérez",
  phone: "+56 9 1111 1111",
};

function dependencies() {
  const guestRepository =
    createMockGuestRepository<MockRoomLockOperationContext>();
  const outbox = createMockNotificationOutbox<MockRoomLockOperationContext>();
  const reservationRepository = createMockReservationRepository();
  return {
    guestRepository,
    outbox,
    reservationRepository,
    params: {
      guestCandidate: guest,
      guestRepository,
      interval: createLodgingInterval("2052-05-01", "2052-05-03"),
      notificationOutboxWriter: outbox,
      reservationRepository,
      roomLockGateway: createMockRoomLockGateway(),
      rooms: [mockDemoRooms[0]],
    },
  };
}

describe("reservations entered from the administration panel", () => {
  it.each(manualOrigins)(
    "enqueues no confirmation for a %s reservation, while still persisting it",
    async (origin) => {
      const { guestRepository, outbox, reservationRepository, params } =
        dependencies();

      const created = await createMultiRoomPayAtPropertyReservation({
        ...params,
        origin,
      });

      expect(created.notificationOutboxIds).toEqual([]);
      expect(outbox.list()).toEqual([]);
      expect(created.reservation.status).toBe("confirmed");
      expect(created.payment.status).toBe("pending");
      expect(await reservationRepository.listReservations?.()).toHaveLength(1);
      expect(
        await guestRepository.getGuestById(created.reservation.guestId)
      ).not.toBeNull();
    }
  );

  it("still enqueues both copies for a website booking", async () => {
    const { outbox, params } = dependencies();

    const created = await createMultiRoomPayAtPropertyReservation(params);

    expect(outbox.list().map((intent) => intent.type)).toEqual([
      "reservation_confirmed_guest",
      "reservation_confirmed_admin",
    ]);
    expect(created.notificationOutboxIds).toHaveLength(2);
  });

  it("decides by origin alone, so no composition can reinstate the emails", () => {
    expect(reservationOriginNotifiesOnConfirmation("website")).toBe(true);
    for (const origin of manualOrigins) {
      expect(reservationOriginNotifiesOnConfirmation(origin)).toBe(false);
    }
  });
});
