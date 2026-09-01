import { describe, expect, it } from "vitest";
import { createLodgingInterval } from "@/features/availability";
import { mockDemoRooms } from "@/features/rooms";
import { createPayAtPropertyReservation } from "@/features/reservations";
import { getPayAtPropertyCollectionService } from "@/features/payments/pay-at-property-collection";
import {
  getMockReservationPaymentAdminView,
  mockGuestRepository,
  mockReservationRepository,
  mockRoomLockGateway,
} from "@/features/reservations/confirm-pay-at-property";

describe("pay at property collection", () => {
  it("approves exact pending payment without changing reservation dates or status", async () => {
    const created = await createPayAtPropertyReservation({
      guestCandidate: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@example.com",
        phone: "123",
        guestCount: 1,
      },
      guestRepository: mockGuestRepository,
      interval: createLodgingInterval("2035-01-01", "2035-01-03"),
      reservationRepository: mockReservationRepository,
      room: mockDemoRooms[0],
      roomLockGateway: mockRoomLockGateway,
    });
    const before = await getMockReservationPaymentAdminView(
      created.reservation.id
    );
    expect(before?.paymentStatus).toBe("pending");
    const service = getPayAtPropertyCollectionService()!;
    await expect(
      service.collect(
        {
          reservationId: created.reservation.id,
          amountClp: created.reservation.totalClp + 1,
          collectedOn: "2035-01-03",
          medium: "cash",
        },
        "admin-1"
      )
    ).rejects.toThrow();
    await service.collect(
      {
        reservationId: created.reservation.id,
        amountClp: created.reservation.totalClp,
        collectedOn: "2035-01-03",
        medium: "cash",
      },
      "admin-1"
    );
    const after = await getMockReservationPaymentAdminView(
      created.reservation.id
    );
    expect(after).toMatchObject({
      paymentStatus: "approved",
      checkIn: before?.checkIn,
      checkOut: before?.checkOut,
      status: before?.status,
    });
    await expect(
      service.collect(
        {
          reservationId: created.reservation.id,
          amountClp: created.reservation.totalClp,
          collectedOn: "2035-01-03",
          medium: "cash",
        },
        "admin-1"
      )
    ).rejects.toThrow();
  });
});
