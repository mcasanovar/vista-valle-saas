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
  editReservationInvoice,
  InvalidInvoiceRequestInputError,
  ReservationNotFoundError,
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

const VALID_RUT = "76086428-5";

function setUp() {
  const roomLockGateway = createMockRoomLockGateway();
  return {
    guestRepository:
      createMockGuestRepository<MockRoomLockOperationContext>(),
    reservationRepository: createMockReservationRepository(),
    roomLockGateway,
  };
}

async function createReservation(setup: ReturnType<typeof setUp>) {
  const { guestRepository, reservationRepository, roomLockGateway } = setup;
  const { reservation } = await createMultiRoomPayAtPropertyReservation({
    guestCandidate: GUEST,
    guestRepository,
    interval: createLodgingInterval("2026-10-05", "2026-10-08"),
    origin: "website",
    reservationRepository,
    roomLockGateway,
    rooms: [ROOM],
  });
  return reservation;
}

describe("editReservationInvoice", () => {
  it("adds an invoice request to a reservation that had none", async () => {
    const setup = setUp();
    const reservation = await createReservation(setup);
    expect(reservation.invoiceRequest).toBeUndefined();

    const updated = await editReservationInvoice({
      input: {
        businessActivity: "Comercio",
        email: "facturacion@example.com",
        name: "Empresa SpA",
        phone: "+56 9 1111 2222",
        requested: true,
        reservationId: reservation.id,
        rut: VALID_RUT,
      },
      reservationRepository: setup.reservationRepository,
    });

    expect(updated.invoiceRequest).toMatchObject({
      businessActivity: "Comercio",
      email: "facturacion@example.com",
      name: "Empresa SpA",
      phone: "+56 9 1111 2222",
      rut: VALID_RUT,
    });
  });

  it("removes an existing invoice request", async () => {
    const setup = setUp();
    const reservation = await createReservation(setup);
    await editReservationInvoice({
      input: {
        businessActivity: "Comercio",
        email: "facturacion@example.com",
        name: "Empresa SpA",
        phone: "+56 9 1111 2222",
        requested: true,
        reservationId: reservation.id,
        rut: VALID_RUT,
      },
      reservationRepository: setup.reservationRepository,
    });

    const updated = await editReservationInvoice({
      input: { requested: false, reservationId: reservation.id },
      reservationRepository: setup.reservationRepository,
    });

    expect(updated.invoiceRequest).toBeUndefined();
  });

  it("rejects an incomplete invoice request", async () => {
    const setup = setUp();
    const reservation = await createReservation(setup);

    await expect(
      editReservationInvoice({
        input: {
          name: "Empresa SpA",
          requested: true,
          reservationId: reservation.id,
        },
        reservationRepository: setup.reservationRepository,
      })
    ).rejects.toBeInstanceOf(InvalidInvoiceRequestInputError);
  });

  it("rejects an invalid Chilean RUT", async () => {
    const setup = setUp();
    const reservation = await createReservation(setup);

    await expect(
      editReservationInvoice({
        input: {
          businessActivity: "Comercio",
          email: "facturacion@example.com",
          name: "Empresa SpA",
          phone: "+56 9 1111 2222",
          requested: true,
          reservationId: reservation.id,
          rut: "76086428-4",
        },
        reservationRepository: setup.reservationRepository,
      })
    ).rejects.toBeInstanceOf(InvalidInvoiceRequestInputError);
  });

  it("rejects an unknown reservation id", async () => {
    const setup = setUp();

    await expect(
      editReservationInvoice({
        input: { requested: false, reservationId: "unknown" },
        reservationRepository: setup.reservationRepository,
      })
    ).rejects.toBeInstanceOf(ReservationNotFoundError);
  });
});
