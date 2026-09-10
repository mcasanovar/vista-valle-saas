import { describe, expect, it } from "vitest";

import {
  type MockRoomLockOperationContext,
  type RoomLockGateway,
} from "@/features/availability";
import {
  createManualReservationWith,
  type ManualReservationDependencies,
} from "@/features/admin/manual-reservation";
import { createMockNotificationOutbox } from "@/features/notifications";
import { createRoomReadSource } from "@/features/rooms/read-model";
import { createMockGuestRepository } from "@/features/reservations/guest-repository";
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
    id: "production-room-a",
    images: [{ alt: "Habitación", id: "production-image-a", src: "/room.jpg" }],
    isDemonstration: false,
    name: "Habitación A",
    nightlyPriceClp: 75_000,
    occupancyPrices: [],
    slug: "production-room-a",
  },
]);

function productionContextAdapter() {
  const mockGuestContext: MockRoomLockOperationContext = {
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
        repository.createConfirmedPayAtPropertyReservation(
          mockGuestContext,
          input
        ),
      createConfirmedPayNowReservation: (_transaction, input) =>
        repository.createConfirmedPayNowReservation(mockGuestContext, input),
      transitionReservationState: (_transaction, transition) =>
        repository.transitionReservationState(mockGuestContext, transition),
      rollbackConfirmedPayAtPropertyReservation:
        rollbackConfirmedPayAtPropertyReservation
          ? (_transaction, created) =>
              rollbackConfirmedPayAtPropertyReservation(
                mockGuestContext,
                created
              )
          : undefined,
    };

  return {
    dependencies: {
      guestRepository:
        createMockGuestRepository<ProductionRoomLockTransaction>(),
      notificationOutboxWriter:
        createMockNotificationOutbox<ProductionRoomLockTransaction>(),
      reservationRepository,
      roomLockGateway,
    } satisfies ManualReservationDependencies<ProductionRoomLockTransaction>,
  };
}

describe("manual reservation production composition", () => {
  it("ignores manipulated client price, status, payment, and availability", async () => {
    const { dependencies } = productionContextAdapter();
    const created = await createManualReservationWith(
      {
        availability: false,
        checkIn: "2032-04-10",
        checkOut: "2032-04-12",
        email: "production-composition@example.test",
        firstName: "Production",
        guestCount: 1,
        lastName: "Composition",
        origin: "phone",
        paymentStatus: "approved",
        phone: "+56 9 1234 5678",
        price: 1,
        roomIds: ["production-room-a"],
        status: "cancelled",
        totalClp: 1,
      },
      "00000000-0000-4000-8000-000000000999",
      roomSource,
      dependencies
    );

    expect(created.reservation).toMatchObject({
      origin: "phone",
      paymentMode: "pay_at_property",
      status: "confirmed",
      totalClp: 150_000,
    });
    expect(created.payment).toMatchObject({
      amountClp: 150_000,
      mode: "pay_at_property",
      status: "pending",
    });
  });
});
