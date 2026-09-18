import { describe, expect, it } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import {
  createMockGuestRepository,
  createMockReservationRepository,
  createMultiRoomPayAtPropertyReservation,
  editReservationGuestContact,
  InvalidGuestInputError,
  ReservationNotFoundError,
  transitionReservationState,
} from "@/features/reservations";

const ROOM = Object.freeze({
  capacity: 2,
  id: "room-a",
  nightlyPriceClp: 60_000,
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
    guestRepository:
      createMockGuestRepository<MockRoomLockOperationContext>(),
    reservationRepository: createMockReservationRepository(),
    roomLockGateway,
  };
}

async function createReservation(
  setup: ReturnType<typeof setUp>,
  origin: "admin" | "airbnb" | "booking" | "phone" | "website" | "whatsapp",
  status?: "cancelled" | "completed" | "confirmed" | "no_show"
) {
  const { guestRepository, reservationRepository, roomLockGateway } = setup;
  const { reservation } = await createMultiRoomPayAtPropertyReservation({
    guestCandidate: GUEST,
    guestRepository,
    interval: createLodgingInterval("2026-10-05", "2026-10-08"),
    origin,
    reservationRepository,
    roomLockGateway,
    rooms: [ROOM],
  });

  if (status && status !== "confirmed") {
    await transitionReservationState({
      reservationId: reservation.id,
      reservationRepository,
      roomLockGateway,
      to: status,
    });
  }

  return reservation;
}

describe("editReservationGuestContact", () => {
  it("updates each contact field on a confirmed reservation without touching dates, price, or status", async () => {
    const setup = setUp();
    const reservation = await createReservation(setup, "website");

    const updated = await editReservationGuestContact({
      guestRepository: setup.guestRepository,
      input: {
        email: "nueva@example.com",
        firstName: "Nueva",
        lastName: "Persona",
        phone: "+56 9 9999 8888",
        reservationId: reservation.id,
      },
      reservationRepository: setup.reservationRepository,
    });

    expect(updated).toMatchObject({
      email: "nueva@example.com",
      firstName: "Nueva",
      lastName: "Persona",
      phone: "+56 9 9999 8888",
    });

    const unchangedReservation =
      await setup.reservationRepository.getReservationById(reservation.id);
    expect(unchangedReservation?.checkIn).toBe("2026-10-05");
    expect(unchangedReservation?.checkOut).toBe("2026-10-08");
    expect(unchangedReservation?.totalClp).toBe(reservation.totalClp);
    expect(unchangedReservation?.status).toBe("confirmed");
  });

  it.each(["airbnb", "booking"] as const)(
    "updates contact info on a %s-origin reservation just like a reservation of local origin",
    async (origin) => {
      const setup = setUp();
      const reservation = await createReservation(setup, origin);

      const updated = await editReservationGuestContact({
        guestRepository: setup.guestRepository,
        input: {
          email: "real@example.com",
          firstName: "Real",
          lastName: "Guest",
          phone: "+56 9 1111 2222",
          reservationId: reservation.id,
        },
        reservationRepository: setup.reservationRepository,
      });

      expect(updated.email).toBe("real@example.com");
    }
  );

  it.each(["cancelled", "completed", "no_show"] as const)(
    "updates contact info on a %s reservation",
    async (status) => {
      const setup = setUp();
      const reservation = await createReservation(setup, "website", status);

      const updated = await editReservationGuestContact({
        guestRepository: setup.guestRepository,
        input: {
          email: "otra@example.com",
          firstName: "Otra",
          lastName: "Persona",
          phone: "+56 9 3333 4444",
          reservationId: reservation.id,
        },
        reservationRepository: setup.reservationRepository,
      });

      expect(updated.email).toBe("otra@example.com");
    }
  );

  it("rejects an invalid email and leaves the guest untouched", async () => {
    const setup = setUp();
    const reservation = await createReservation(setup, "website");

    await expect(
      editReservationGuestContact({
        guestRepository: setup.guestRepository,
        input: {
          email: "not-an-email",
          firstName: "Ana",
          lastName: "Perez",
          phone: "+56 9 1234 5678",
          reservationId: reservation.id,
        },
        reservationRepository: setup.reservationRepository,
      })
    ).rejects.toBeInstanceOf(InvalidGuestInputError);

    const guest = await setup.guestRepository.getGuestById(reservation.guestId);
    expect(guest?.email).toBe("ana@example.com");
  });

  it("rejects an unknown reservation id", async () => {
    const setup = setUp();

    await expect(
      editReservationGuestContact({
        guestRepository: setup.guestRepository,
        input: {
          email: "otra@example.com",
          firstName: "Otra",
          lastName: "Persona",
          phone: "+56 9 3333 4444",
          reservationId: "unknown",
        },
        reservationRepository: setup.reservationRepository,
      })
    ).rejects.toBeInstanceOf(ReservationNotFoundError);
  });
});
