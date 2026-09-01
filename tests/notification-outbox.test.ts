import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import { createManualReservation } from "@/features/admin/manual-reservation";
import {
  createMockNotificationOutbox,
  createNotificationOutboxWriter,
  getMockNotificationOutboxIntents,
} from "@/features/notifications";
import {
  createPayAtPropertyCollectionService,
  getPayAtPropertyCollectionService,
} from "@/features/payments/pay-at-property-collection";
import { mockDemoRooms } from "@/features/rooms";
import { createMockGuestRepository } from "@/features/reservations/guest-repository";
import {
  createMultiRoomPayAtPropertyReservation,
  createPayAtPropertyReservation,
} from "@/features/reservations";
import { createMockReservationRepository } from "@/features/reservations/reservation-repository";
import {
  confirmPayAtPropertyBooking,
  getMockPendingPaymentByReservationId,
  getMockReservationPaymentAdminViewByPublicId,
  mockReservationRepository,
  mockRoomLockGateway,
} from "@/features/reservations/confirm-pay-at-property";

const guest = {
  firstName: "Ana",
  lastName: "Pérez",
  email: "outbox-guest@example.test",
  phone: "123",
  guestCount: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notification outbox", () => {
  it("schedules two guest confirmations for a distinct invoice recipient and keeps multi-room totals in the reservation contract", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const outbox = createMockNotificationOutbox<MockRoomLockOperationContext>();
    const result = await createMultiRoomPayAtPropertyReservation({
      guestCandidate: guest,
      guestRepository:
        createMockGuestRepository<MockRoomLockOperationContext>(),
      interval: createLodgingInterval("2052-01-01", "2052-01-03"),
      reservationRepository: createMockReservationRepository(),
      roomLockGateway,
      rooms: [mockDemoRooms[0], mockDemoRooms[1]],
      notificationOutboxWriter: outbox,
      invoiceRequest: {
        name: "Empresa",
        rut: "76.000.543-6",
        phone: "123",
        businessActivity: "Giro",
        email: "facturas@example.test",
      },
    });
    const guestIntents = outbox
      .list()
      .filter((intent) => intent.type === "reservation_confirmed_guest");
    expect(guestIntents.map((intent) => intent.recipient).sort()).toEqual([
      "facturas@example.test",
      "outbox-guest@example.test",
    ]);
    expect(result.reservation.items).toHaveLength(2);
  });

  it("deduplicates invoice and guest emails after trim and case normalization", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const outbox = createMockNotificationOutbox<MockRoomLockOperationContext>();
    await createMultiRoomPayAtPropertyReservation({
      guestCandidate: { ...guest, email: " Guest@Example.Test " },
      guestRepository:
        createMockGuestRepository<MockRoomLockOperationContext>(),
      interval: createLodgingInterval("2052-02-01", "2052-02-03"),
      reservationRepository: createMockReservationRepository(),
      roomLockGateway,
      rooms: [mockDemoRooms[0]],
      notificationOutboxWriter: outbox,
      invoiceRequest: {
        name: "Empresa",
        rut: "76.000.543-6",
        phone: "123",
        businessActivity: "Giro",
        email: "guest@example.test",
      },
    });
    expect(
      outbox
        .list()
        .filter((intent) => intent.type === "reservation_confirmed_guest")
    ).toHaveLength(1);
  });
  it("fails closed in production instead of using mock notification intents", () => {
    expect(createNotificationOutboxWriter("production")).toBeNull();
  });

  it("writes exactly one guest and admin intent with a confirmed public booking, without a provider call", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    const confirmation = await confirmPayAtPropertyBooking({
      ...guest,
      room: "demo-room-valle",
      checkIn: "2051-01-01",
      checkOut: "2051-01-03",
    });
    const reservation = await getMockReservationPaymentAdminViewByPublicId(
      confirmation.publicId
    );
    const intents = getMockNotificationOutboxIntents().filter(
      (intent) => intent.reservationId === reservation?.id
    );

    expect(intents).toHaveLength(2);
    expect(intents.map((intent) => intent.type).sort()).toEqual([
      "reservation_confirmed_admin",
      "reservation_confirmed_guest",
    ]);
    expect(intents.map((intent) => intent.recipient).sort()).toEqual([
      "admin@example.test",
      "outbox-guest@example.test",
    ]);
    expect(JSON.stringify(intents)).not.toContain("externalReference");
    expect(JSON.stringify(intents)).not.toContain("provider");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("integrates manual reservations and payment collection with the shared canonical outbox", async () => {
    const manual = await createManualReservation(
      {
        ...guest,
        origin: "booking",
        room: "demo-room-andes",
        checkIn: "2051-02-01",
        checkOut: "2051-02-03",
      },
      "admin-outbox"
    );
    const reservationIntents = getMockNotificationOutboxIntents().filter(
      (intent) => intent.reservationId === manual.reservation.id
    );
    expect(reservationIntents).toHaveLength(2);

    const payment = await getMockPendingPaymentByReservationId(
      manual.reservation.id
    );
    await getPayAtPropertyCollectionService()!.collect(
      {
        reservationId: manual.reservation.id,
        amountClp: manual.reservation.totalClp,
        collectedOn: "2051-02-01",
        medium: "cash",
      },
      "admin-outbox"
    );
    const paymentIntents = getMockNotificationOutboxIntents().filter(
      (intent) => intent.paymentId === payment?.payment.id
    );
    expect(paymentIntents).toEqual([
      expect.objectContaining({
        reservationId: manual.reservation.id,
        type: "payment_collected_admin",
      }),
    ]);
  });

  it("rolls back mock reservation and payment state when an outbox write fails", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const mockGuestRepository =
      createMockGuestRepository<MockRoomLockOperationContext>();
    let createdGuestId: string | undefined;
    const guestRepository = Object.freeze({
      ...mockGuestRepository,
      createGuest: async (
        ...args: Parameters<typeof mockGuestRepository.createGuest>
      ) => {
        const record = await mockGuestRepository.createGuest(...args);
        createdGuestId = record.id;
        return record;
      },
    });
    const reservationRepository = createMockReservationRepository();
    const failingOutbox =
      createMockNotificationOutbox<MockRoomLockOperationContext>(() => true);
    const params = {
      guestCandidate: guest,
      guestRepository,
      interval: createLodgingInterval("2051-03-01", "2051-03-03"),
      reservationRepository,
      room: mockDemoRooms[0],
      roomLockGateway,
    };

    await expect(
      createPayAtPropertyReservation({
        ...params,
        generatePublicId: () => "VV-outbox-failure",
        notificationOutboxWriter: failingOutbox,
      })
    ).rejects.toThrow("Notification outbox unavailable");
    expect(await reservationRepository.listReservations?.()).toEqual([]);
    expect(failingOutbox.list()).toEqual([]);
    expect(createdGuestId).toBeDefined();
    expect(await guestRepository.getGuestById(createdGuestId!)).toBeNull();

    await expect(
      createPayAtPropertyReservation({
        ...params,
        generatePublicId: () => "VV-outbox-failure",
      })
    ).resolves.toMatchObject({ reservation: { roomId: "demo-room-valle" } });

    const created = await createPayAtPropertyReservation({
      guestCandidate: guest,
      guestRepository: mockGuestRepository,
      interval: createLodgingInterval("2051-04-01", "2051-04-03"),
      reservationRepository: mockReservationRepository,
      room: mockDemoRooms[2],
      roomLockGateway: mockRoomLockGateway,
    });
    const failingCollection = createPayAtPropertyCollectionService(
      createMockNotificationOutbox(() => true)
    );
    await expect(
      failingCollection!.collect(
        {
          reservationId: created.reservation.id,
          amountClp: created.reservation.totalClp,
          collectedOn: "2051-04-01",
          medium: "cash",
        },
        "admin-outbox"
      )
    ).rejects.toThrow("Notification outbox unavailable");
    expect(
      await getMockPendingPaymentByReservationId(created.reservation.id)
    ).not.toBeNull();
  });
});
