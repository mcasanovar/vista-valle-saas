import { describe, expect, it } from "vitest";
import { createLodgingInterval } from "@/features/availability";
import { mockDemoRooms } from "@/features/rooms";
import { createPayAtPropertyReservation } from "@/features/reservations";
import {
  confirmPayAtPropertyBooking,
  getMockReservationPaymentAdminViewByPublicId,
  mockGuestRepository,
  mockReservationRepository,
  mockRoomLockGateway,
} from "@/features/reservations/confirm-pay-at-property";
import { getChannelSyncTasks } from "@/features/channel-sync/tasks";
import { createManualReservation } from "@/features/admin/manual-reservation";

describe("website channel sync", () => {
  it("creates two pending tasks and completion does not alter reservation", async () => {
    const before = await createPayAtPropertyReservation({
      guestCandidate: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@example.com",
        phone: "123",
        guestCount: 1,
      },
      guestRepository: mockGuestRepository,
      interval: createLodgingInterval("2038-01-01", "2038-01-03"),
      reservationRepository: mockReservationRepository,
      room: mockDemoRooms[0],
      roomLockGateway: mockRoomLockGateway,
    });
    const tasks = getChannelSyncTasks()!;
    expect(
      tasks.pending().filter((x) => x.reservationId === before.reservation.id)
    ).toHaveLength(0);
    const website = await confirmPayAtPropertyBooking({
      room: mockDemoRooms[1].id,
      checkIn: "2038-02-01",
      checkOut: "2038-02-03",
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "123",
      guestCount: 1,
    });
    const canonical = await getMockReservationPaymentAdminViewByPublicId(
      website.publicId
    );
    const pending = tasks
      .pending()
      .filter((x) => x.platform === "airbnb" || x.platform === "booking");
    expect(
      pending
        .slice(-2)
        .map((x) => x.platform)
        .sort()
    ).toEqual(["airbnb", "booking"]);
    const first = tasks.complete(pending.at(-2)!.id, "admin-1");
    expect(first).toMatchObject({
      completedBy: "admin-1",
      status: "completed",
    });
    tasks.complete(pending.at(-1)!.id, "admin-1");
    expect(tasks.pending().filter((x) => x.id === first.id)).toHaveLength(0);
    expect(
      await getMockReservationPaymentAdminViewByPublicId(website.publicId)
    ).toMatchObject(canonical!);
    const beforeManual = tasks.pending().length;
    const manual = await createManualReservation(
      {
        room: mockDemoRooms[2].id,
        origin: "booking",
        checkIn: "2038-03-01",
        checkOut: "2038-03-03",
        firstName: "Ana",
        lastName: "Pérez",
        email: "ana@example.com",
        phone: "123",
        guestCount: 1,
      },
      "admin-1"
    );
    expect(
      tasks
        .pending()
        .filter((task) => task.reservationId === manual.reservation.id)
    ).toHaveLength(0);
    expect(tasks.pending()).toHaveLength(beforeManual);
  });
});
