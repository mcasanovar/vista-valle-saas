import { describe, expect, it, vi } from "vitest";

import {
  type MockRoomLockOperationContext,
  type RoomLockGateway,
} from "@/features/availability";
import { createMockNotificationOutbox } from "@/features/notifications";
import { createRoomReadSource } from "@/features/rooms/read-model";
import { createMockGuestRepository } from "@/features/reservations/guest-repository";
import {
  confirmPayAtPropertyBookingWith,
  type PayAtPropertyBookingDependencies,
} from "@/features/reservations/confirm-pay-at-property";
import {
  createMockReservationRepository,
  type ReservationRepository,
} from "@/features/reservations/reservation-repository";
import type { ProductionRoomLockTransaction } from "@/infrastructure/database/room-lock";

const roomSource = createRoomReadSource("production", [
  {
    active: true,
    amenities: ["Calefacción"],
    bathroom: "Privado",
    bedConfiguration: "Matrimonial",
    capacity: 2,
    description: "Habitación persistente de prueba",
    id: "website-booking-room-a",
    images: [{ alt: "Habitación", id: "website-booking-image-a", src: "/room.jpg" }],
    isDemonstration: false,
    name: "Habitación A",
    nightlyPriceClp: 70_000,
    occupancyPrices: [],
    slug: "website-booking-room-a",
  },
]);

/**
 * Mirrors `manual-reservation-production-composition.test.ts`: the booking
 * runs against repositories typed for the production transaction context,
 * which is the shape that silently lost every confirmation email when a
 * mock-only outbox writer was wired into the production service.
 */
function productionContextDependencies() {
  const mockContext: MockRoomLockOperationContext = {
    recordOccupancy: () => undefined,
    removeOccupancy: () => undefined,
  };
  const repository = createMockReservationRepository();
  const { rollbackConfirmedPayAtPropertyReservation, ...sharedRepository } =
    repository;
  const transaction = {} as ProductionRoomLockTransaction;
  const roomLockGateway: RoomLockGateway<ProductionRoomLockTransaction> = {
    runExclusive: (_roomId, _interval, operation) => operation(transaction),
    runExclusiveMany: (_roomIds, _interval, operation) =>
      operation(transaction),
    runLocked: (_roomId, operation) => operation(transaction),
    runLockedMany: (_roomIds, operation) => operation(transaction),
  };
  const reservationRepository: ReservationRepository<ProductionRoomLockTransaction> =
    {
      ...sharedRepository,
      createConfirmedPayAtPropertyReservation: (_transaction, input) =>
        repository.createConfirmedPayAtPropertyReservation(mockContext, input),
      createConfirmedPayNowReservation: (_transaction, input) =>
        repository.createConfirmedPayNowReservation(mockContext, input),
      transitionReservationState: (_transaction, transition) =>
        repository.transitionReservationState(mockContext, transition),
      editReservationStay: (_transaction, input) =>
        repository.editReservationStay!(mockContext, input),
      editReservationNightlyRates: (_transaction, input) =>
        repository.editReservationNightlyRates!(mockContext, input),
      rollbackConfirmedPayAtPropertyReservation:
        rollbackConfirmedPayAtPropertyReservation
          ? (_transaction, created) =>
              rollbackConfirmedPayAtPropertyReservation(mockContext, created)
          : undefined,
    };
  const outbox = createMockNotificationOutbox<ProductionRoomLockTransaction>();
  const deliverNotifications = vi.fn<(ids: readonly string[]) => void>();

  return {
    deliverNotifications,
    outbox,
    dependencies: {
      deliverNotifications,
      guestRepository:
        createMockGuestRepository<ProductionRoomLockTransaction>(),
      notificationOutboxWriter: outbox,
      reservationRepository,
      roomLockGateway,
    } satisfies PayAtPropertyBookingDependencies<ProductionRoomLockTransaction>,
  };
}

const booking = {
  checkIn: "2033-03-10",
  checkOut: "2033-03-12",
  email: "Huesped.Web@Example.Test",
  firstName: "Camila",
  guestCount: "2",
  lastName: "Soto",
  phone: "+56 9 2222 2222",
  rooms: "website-booking-room-a",
};

describe("website booking confirmation email", () => {
  it("enqueues the guest and the administrative copy, and attempts their delivery right away", async () => {
    const { deliverNotifications, dependencies, outbox } =
      productionContextDependencies();

    const confirmation = await confirmPayAtPropertyBookingWith(
      booking,
      roomSource,
      dependencies
    );

    expect(confirmation.paymentMode).toBe("PAY_AT_PROPERTY");
    const intents = outbox.list();
    expect(
      intents.map((intent) => ({
        recipient: intent.recipient,
        status: intent.status,
        type: intent.type,
      }))
    ).toEqual([
      {
        recipient: "huesped.web@example.test",
        status: "pending",
        type: "reservation_confirmed_guest",
      },
      {
        recipient: expect.any(String),
        status: "pending",
        type: "reservation_confirmed_admin",
      },
    ]);
    expect(deliverNotifications).toHaveBeenCalledTimes(1);
    expect(deliverNotifications.mock.calls[0]![0]).toEqual(
      intents.map((intent) => intent.id)
    );
  });

  it("also enqueues the invoice contact when the guest asked for one", async () => {
    const { deliverNotifications, dependencies, outbox } =
      productionContextDependencies();

    await confirmPayAtPropertyBookingWith(
      {
        ...booking,
        invoiceRequested: "true",
        invoiceName: "Empresa",
        invoiceRut: "76.000.543-6",
        invoicePhone: "+56 9 3333 3333",
        invoiceBusinessActivity: "Giro",
        invoiceEmail: "facturas@example.test",
      },
      roomSource,
      dependencies
    );

    expect(outbox.list().map((intent) => intent.recipient)).toContain(
      "facturas@example.test"
    );
    expect(deliverNotifications.mock.calls[0]![0]).toHaveLength(3);
  });

  it("still confirms the booking when no outbox writer is wired, without claiming a delivery", async () => {
    const { deliverNotifications, dependencies } =
      productionContextDependencies();

    const confirmation = await confirmPayAtPropertyBookingWith(
      booking,
      roomSource,
      { ...dependencies, notificationOutboxWriter: null }
    );

    expect(confirmation.paymentMode).toBe("PAY_AT_PROPERTY");
    expect(deliverNotifications).not.toHaveBeenCalled();
  });
});
