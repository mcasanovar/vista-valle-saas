import { describe, expect, it } from "vitest";
import { createLodgingInterval } from "@/features/availability";
import { mockDemoRooms } from "@/features/rooms";
import { createPayAtPropertyReservation } from "@/features/reservations";
import {
  confirmPayAtPropertyBooking,
  mockGuestRepository,
  mockReservationRepository,
  mockRoomLockGateway,
} from "@/features/reservations/confirm-pay-at-property";
import { getChannelSyncTasks } from "@/features/channel-sync/tasks";
import { getChannelConnections } from "@/features/channel-calendar-sync/connections";

describe("channel sync manual queue skips a platform with an active connection", () => {
  it("only creates a Booking task when Airbnb already has an active connection for the room", async () => {
    const room = mockDemoRooms[1]!;
    const connections = getChannelConnections()!;
    const airbnb = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/active-queue.ics",
      paymentBehavior: "auto_approved",
    });
    connections.setEnabled(airbnb.id, true);

    const tasks = getChannelSyncTasks()!;
    const before = tasks.pending().length;

    const website = await confirmPayAtPropertyBooking({
      room: room.id,
      checkIn: "2043-01-01",
      checkOut: "2043-01-03",
      firstName: "Diego",
      lastName: "Muñoz",
      email: "diego@example.com",
      phone: "+56 9 4444 4444",
      guestCount: 1,
    });
    expect(website.publicId).toBeTruthy();

    const created = tasks.pending().slice(before);
    expect(created.map((task) => task.platform)).toEqual(["booking"]);
  });

  it("creates both tasks when no connection is active for the room", async () => {
    const room = mockDemoRooms[2]!;
    const website = await createPayAtPropertyReservation({
      guestCandidate: {
        firstName: "Laura",
        lastName: "Fuentes",
        email: "laura@example.com",
        phone: "+56 9 5555 5555",
        guestCount: 1,
      },
      guestRepository: mockGuestRepository,
      interval: createLodgingInterval("2043-02-01", "2043-02-03"),
      reservationRepository: mockReservationRepository,
      room,
      roomLockGateway: mockRoomLockGateway,
    });
    // Website-origin reservations created directly (bypassing the public
    // booking action) don't run createWebsiteChannelSyncTasks on their own;
    // exercise it explicitly to prove the "no active connection" baseline.
    const { createWebsiteChannelSyncTasks } = await import(
      "@/features/channel-sync/tasks"
    );
    const created = createWebsiteChannelSyncTasks(website.reservation.id, [
      room.id,
    ]);
    expect(created.map((task) => task.platform).sort()).toEqual([
      "airbnb",
      "booking",
    ]);
  });

  it("still creates the task for a platform whose connection exists but is not enabled", async () => {
    // Both mechanisms coexist without conflict (spec "La cola manual no
    // duplica una conexión activa"): a configured-but-inactive connection
    // must not silently swallow the manual task.
    const room = mockDemoRooms[0]!;
    const connections = getChannelConnections()!;
    const airbnb = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/disabled-queue.ics",
      paymentBehavior: "auto_approved",
    });
    expect(airbnb.enabled).toBe(false); // never enabled in this test

    const website = await createPayAtPropertyReservation({
      guestCandidate: {
        firstName: "Marcelo",
        lastName: "Rojas",
        email: "marcelo@example.com",
        phone: "+56 9 6666 6666",
        guestCount: 1,
      },
      guestRepository: mockGuestRepository,
      interval: createLodgingInterval("2043-03-01", "2043-03-03"),
      reservationRepository: mockReservationRepository,
      room,
      roomLockGateway: mockRoomLockGateway,
    });
    const { createWebsiteChannelSyncTasks } = await import(
      "@/features/channel-sync/tasks"
    );
    const created = createWebsiteChannelSyncTasks(website.reservation.id, [
      room.id,
    ]);
    expect(created.map((task) => task.platform).sort()).toEqual([
      "airbnb",
      "booking",
    ]);
  });
});
