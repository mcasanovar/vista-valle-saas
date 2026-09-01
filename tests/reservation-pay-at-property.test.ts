import { describe, expect, it } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  RoomLockConflictError,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import {
  createMockGuestRepository,
  createMockReservationRepository,
  createMultiRoomPayAtPropertyReservation,
  createPayAtPropertyReservation,
  generateReservationPublicId,
  ReservationStateTransitionError,
  transitionReservationState,
} from "@/features/reservations";

const ROOM = Object.freeze({
  capacity: 2,
  id: "room-a",
  nightlyPriceClp: 60_000,
});

describe("multi-room pay-at-property reservation", () => {
  it("freezes each selected room subtotal, aggregate total, and conditional invoice data", async () => {
    const { guestRepository, reservationRepository, roomLockGateway } = setUp();
    const result = await createMultiRoomPayAtPropertyReservation({
      guestCandidate: GUEST,
      guestRepository,
      interval: createLodgingInterval("2026-10-05", "2026-10-08"),
      reservationRepository,
      roomLockGateway,
      rooms: [ROOM, { ...ROOM, id: "room-b", nightlyPriceClp: 80_000 }],
      invoiceRequest: {
        name: "Empresa SpA",
        rut: "76.000.543-6",
        phone: "+56 9 1234 5678",
        businessActivity: "Hospedaje",
        email: "facturas@example.test",
      },
    });
    expect(result.reservation.items).toEqual([
      expect.objectContaining({ roomId: "room-a", subtotalClp: 180_000 }),
      expect.objectContaining({ roomId: "room-b", subtotalClp: 240_000 }),
    ]);
    expect(result.reservation.totalClp).toBe(420_000);
    expect(result.reservation.invoiceRequest?.email).toBe(
      "facturas@example.test"
    );
  });

  it("creates no partial reservation when one cart room conflicts", async () => {
    const { guestRepository, reservationRepository, roomLockGateway } = setUp();
    const rooms = [ROOM, { ...ROOM, id: "room-b" }];
    await createPayAtPropertyReservation({
      guestCandidate: GUEST,
      guestRepository,
      interval: createLodgingInterval("2026-11-01", "2026-11-05"),
      reservationRepository,
      room: ROOM,
      roomLockGateway,
    });
    await expect(
      createMultiRoomPayAtPropertyReservation({
        guestCandidate: GUEST,
        guestRepository,
        interval: createLodgingInterval("2026-11-01", "2026-11-05"),
        reservationRepository,
        roomLockGateway,
        rooms,
      })
    ).rejects.toBeInstanceOf(RoomLockConflictError);
    expect(await reservationRepository.listReservations?.()).toHaveLength(1);
  });
});
const GUEST = Object.freeze({
  email: "ana@example.com",
  firstName: "Ana",
  guestCount: 2,
  lastName: "Perez",
  phone: "+56 9 1234 5678",
});

function setUp() {
  const roomLockGateway = createMockRoomLockGateway();
  return {
    guestRepository: createMockGuestRepository<MockRoomLockOperationContext>(),
    reservationRepository: createMockReservationRepository(),
    roomLockGateway,
  };
}

describe("createPayAtPropertyReservation", () => {
  it("creates an immediate confirmed website reservation and a separate pending payment with frozen totals", async () => {
    const { guestRepository, reservationRepository, roomLockGateway } = setUp();
    const result = await createPayAtPropertyReservation({
      charges: [{ amountClp: 10_000, label: "configured charge" }],
      generatePublicId: () => "VV-test-non-guessable-id",
      guestCandidate: { ...GUEST, totalClp: 1 },
      guestRepository,
      interval: createLodgingInterval("2024-05-05", "2024-05-08"),
      reservationRepository,
      room: ROOM,
      roomLockGateway,
    });

    expect(result.reservation).toMatchObject({
      chargesClp: 10_000,
      origin: "website",
      paymentMode: "pay_at_property",
      publicId: "VV-test-non-guessable-id",
      status: "confirmed",
      totalClp: 190_000,
    });
    expect(result.payment).toMatchObject({
      amountClp: 190_000,
      mode: "pay_at_property",
      provider: "pay_at_property",
      reservationId: result.reservation.id,
      status: "pending",
    });
    expect(result.payment.externalReference).toBe(
      "pay-at-property:VV-test-non-guessable-id"
    );
    expect(
      await reservationRepository.getReservationById(result.reservation.id)
    ).toEqual(result.reservation);
  });

  it("generates UUID-based public identifiers that are non-sequential and unguessable", () => {
    const first = generateReservationPublicId();
    const second = generateReservationPublicId();
    expect(first).toMatch(/^VV-[0-9a-f-]{36}$/);
    expect(second).toMatch(/^VV-[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });

  it("rechecks under the room lock so concurrent overlapping reservations produce exactly one confirmation", async () => {
    const { guestRepository, reservationRepository, roomLockGateway } = setUp();
    const attempt = () =>
      createPayAtPropertyReservation({
        guestCandidate: GUEST,
        guestRepository,
        interval: createLodgingInterval("2024-07-01", "2024-07-05"),
        reservationRepository,
        room: ROOM,
        roomLockGateway,
      });
    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: expect.any(RoomLockConflictError),
    });
  });

  it("allows a same-day turnover", async () => {
    const { guestRepository, reservationRepository, roomLockGateway } = setUp();
    const first = await createPayAtPropertyReservation({
      guestCandidate: GUEST,
      guestRepository,
      interval: createLodgingInterval("2024-07-01", "2024-07-05"),
      reservationRepository,
      room: ROOM,
      roomLockGateway,
    });
    const second = await createPayAtPropertyReservation({
      guestCandidate: GUEST,
      guestRepository,
      interval: createLodgingInterval("2024-07-05", "2024-07-06"),
      reservationRepository,
      room: ROOM,
      roomLockGateway,
    });
    expect(second.reservation.id).not.toBe(first.reservation.id);
  });

  it("permits every terminal state from confirmed, frees availability, and rejects a second transition", async () => {
    for (const to of ["cancelled", "completed", "no_show"] as const) {
      const { guestRepository, reservationRepository, roomLockGateway } =
        setUp();
      const result = await createPayAtPropertyReservation({
        guestCandidate: GUEST,
        guestRepository,
        interval: createLodgingInterval("2024-08-01", "2024-08-04"),
        reservationRepository,
        room: ROOM,
        roomLockGateway,
      });
      const transitioned = await transitionReservationState({
        actorUserId: "admin-1",
        reservationId: result.reservation.id,
        reservationRepository,
        roomLockGateway,
        to,
      });
      expect(transitioned.status).toBe(to);
      await roomLockGateway.runExclusive(
        ROOM.id,
        createLodgingInterval("2024-08-01", "2024-08-04"),
        async () => "available again"
      );
    }

    const { guestRepository, reservationRepository, roomLockGateway } = setUp();
    const result = await createPayAtPropertyReservation({
      guestCandidate: GUEST,
      guestRepository,
      interval: createLodgingInterval("2024-08-01", "2024-08-04"),
      reservationRepository,
      room: ROOM,
      roomLockGateway,
    });
    await transitionReservationState({
      reservationId: result.reservation.id,
      reservationRepository,
      roomLockGateway,
      to: "cancelled",
    });
    await expect(
      transitionReservationState({
        reservationId: result.reservation.id,
        reservationRepository,
        roomLockGateway,
        to: "completed",
      })
    ).rejects.toBeInstanceOf(ReservationStateTransitionError);
  });
});
