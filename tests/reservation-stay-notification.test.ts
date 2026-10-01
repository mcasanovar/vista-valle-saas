import { describe, expect, it } from "vitest";

import {
  createMockRoomLockGateway,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import {
  createLodgingInterval,
  nights as lodgingNights,
} from "@/features/availability";
import { createMockNotificationOutbox } from "@/features/notifications";
import { renderReservationDatesChangedAdminEmail } from "@/features/notifications/email-template-renderer";
import {
  editReservationStay,
  ReservationStayRequiresRoomError,
} from "@/features/reservations/edit-reservation-stay";
import {
  createMockReservationRepository,
  type ReservationRecord,
} from "@/features/reservations/reservation-repository";

type Gateway = ReturnType<typeof createMockRoomLockGateway>;
type Repository = ReturnType<typeof createMockReservationRepository>;

function ratesOf(rates: Record<string, number>) {
  return async (roomIds: readonly string[]) =>
    new Map(
      roomIds.flatMap((roomId) => {
        const price = rates[roomId];
        if (price === undefined) return [];
        return [
          [
            roomId,
            Object.freeze({
              capacity: 4,
              id: roomId,
              nightlyPriceClp: price,
              occupancyPrices: [],
            }),
          ] as const,
        ];
      })
    );
}

async function createReservation(
  roomLockGateway: Gateway,
  reservationRepository: Repository,
  params: Readonly<{
    checkIn: string;
    checkOut: string;
    publicId: string;
    rooms: readonly Readonly<{ nightlyPriceClp: number; roomId: string }>[];
  }>
): Promise<ReservationRecord> {
  const interval = createLodgingInterval(params.checkIn, params.checkOut);
  const nights = lodgingNights(interval.checkIn, interval.checkOut);
  const { reservation } = await roomLockGateway.runExclusiveMany(
    params.rooms.map((room) => room.roomId),
    interval,
    (context: MockRoomLockOperationContext) =>
      reservationRepository.createConfirmedPayAtPropertyReservation(context, {
        checkIn: interval.checkIn,
        checkOut: interval.checkOut,
        guestCount: params.rooms.length * 2,
        guestId: "guest-1",
        items: params.rooms.map((room) => ({
          chargesClp: 0,
          guestCount: 2,
          nightlyPriceClp: room.nightlyPriceClp,
          nights,
          roomId: room.roomId,
          totalClp: nights * room.nightlyPriceClp,
        })),
        publicId: params.publicId,
      })
  );
  return reservation;
}

describe("stay-change notification (task 4.3)", () => {
  it("enqueues exactly one admin intent and none for the guest", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const outbox = createMockNotificationOutbox<MockRoomLockOperationContext>();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2027-05-01",
        checkOut: "2027-05-03",
        publicId: "VV-stay-notify",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-a" }],
      }
    );

    await editReservationStay({
      getRoomRates: ratesOf({ "room-b": 30_000 }),
      input: {
        items: [{ guestCount: 2, roomId: "room-b" }],
        reservationId: reservation.id,
      },
      notificationOutboxWriter: outbox,
      reservationRepository,
      roomLockGateway,
    });

    const intents = outbox
      .list()
      .filter((intent) => intent.reservationId === reservation.id);
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: "reservation_dates_changed_admin",
    });
    expect(
      intents.filter((intent) => intent.type.endsWith("_guest"))
    ).toHaveLength(0);
  });

  it("carries the pre-edit stay so the removed room can be named", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const outbox = createMockNotificationOutbox<MockRoomLockOperationContext>();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2027-06-01",
        checkOut: "2027-06-03",
        publicId: "VV-stay-snapshot",
        rooms: [
          { nightlyPriceClp: 50_000, roomId: "room-a" },
          { nightlyPriceClp: 40_000, roomId: "room-b" },
        ],
      }
    );

    await editReservationStay({
      getRoomRates: ratesOf({ "room-a": 50_000 }),
      input: {
        items: [{ guestCount: 3, roomId: "room-a" }],
        reservationId: reservation.id,
      },
      notificationOutboxWriter: outbox,
      reservationRepository,
      roomLockGateway,
    });

    const intent = outbox
      .list()
      .find((candidate) => candidate.reservationId === reservation.id);
    expect(intent?.previousStay).toMatchObject({
      checkIn: "2027-06-01",
      checkOut: "2027-06-03",
    });
    expect(
      intent?.previousStay?.rooms.map((room) => room.roomId).sort()
    ).toEqual(["room-a", "room-b"]);
  });
});

describe("rejected stay edit writes nothing (task 4.4)", () => {
  it("enqueues no notification when the edit leaves no rooms", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const outbox = createMockNotificationOutbox<MockRoomLockOperationContext>();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2027-07-01",
        checkOut: "2027-07-03",
        publicId: "VV-stay-rejected",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-a" }],
      }
    );

    await expect(
      editReservationStay({
        getRoomRates: ratesOf({ "room-a": 50_000 }),
        input: { items: [], reservationId: reservation.id },
        notificationOutboxWriter: outbox,
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(ReservationStayRequiresRoomError);

    expect(outbox.list()).toHaveLength(0);
  });

  it("enqueues no notification when the requested occupancy exceeds capacity", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const outbox = createMockNotificationOutbox<MockRoomLockOperationContext>();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2027-08-01",
        checkOut: "2027-08-03",
        publicId: "VV-stay-capacity",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-a" }],
      }
    );

    await expect(
      editReservationStay({
        getRoomRates: ratesOf({ "room-a": 50_000 }),
        input: {
          items: [{ guestCount: 9, roomId: "room-a" }],
          reservationId: reservation.id,
        },
        notificationOutboxWriter: outbox,
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toThrow();

    expect(outbox.list()).toHaveLength(0);
  });
});

describe("administrative stay-change email (task 4.2)", () => {
  const data = Object.freeze({
    checkIn: "2027-09-10",
    checkOut: "2027-09-12",
    contactEmail: "admin@example.test",
    guestCount: 5,
    items: Object.freeze([
      Object.freeze({
        guestCount: 2,
        roomId: "room-a",
        roomName: "Cabaña Alerce",
        subtotalClp: 100_000,
      }),
      Object.freeze({
        guestCount: 3,
        roomId: "room-c",
        roomName: "Cabaña Coigüe",
        subtotalClp: 90_000,
      }),
    ]),
    nights: 2,
    publicId: "VV-0042",
    roomName: "Cabaña Alerce",
    totalClp: 190_000,
  });

  it("identifies the rooms that came in and the ones that went out", () => {
    const html = renderReservationDatesChangedAdminEmail(data, {
      addedRooms: [{ guestCount: 3, roomName: "Cabaña Coigüe" }],
      datesChanged: false,
      previousCheckIn: "2027-09-10",
      previousCheckOut: "2027-09-12",
      removedRooms: [{ roomName: "Cabaña Mañío" }],
    });

    expect(html).toContain("Habitación agregada: Cabaña Coigüe");
    expect(html).toContain("Habitación quitada: Cabaña Mañío");
    expect(html).not.toContain("Fechas anteriores");
  });

  it("reports the resulting occupancy of every room", () => {
    const html = renderReservationDatesChangedAdminEmail(data);

    expect(html).toContain("Cabaña Alerce — 2 personas");
    expect(html).toContain("Cabaña Coigüe — 3 personas");
  });

  it("reports the previous dates only when the dates moved", () => {
    const html = renderReservationDatesChangedAdminEmail(data, {
      addedRooms: [],
      datesChanged: true,
      previousCheckIn: "2027-09-01",
      previousCheckOut: "2027-09-04",
      removedRooms: [],
    });

    expect(html).toContain("Fechas anteriores: 2027-09-01 — 2027-09-04");
  });

  it("renders without a change section when no snapshot is available", () => {
    const html = renderReservationDatesChangedAdminEmail(data);
    expect(html).not.toContain("Qué cambió");
    expect(html).toContain("Estadía de reserva actualizada");
  });
});
