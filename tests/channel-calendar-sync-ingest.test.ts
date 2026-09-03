import { describe, expect, it } from "vitest";
import { createLodgingInterval } from "@/features/availability";
import { getChannelConnections } from "@/features/channel-calendar-sync/connections";
import { ingestChannelConnection } from "@/features/channel-calendar-sync/ingest";
import { listChannelSyncConflictAlerts } from "@/features/channel-calendar-sync/conflict-alerts";
import { mockDemoRooms } from "@/features/rooms";
import { getMockNotificationOutboxIntents } from "@/features/notifications";
import { createPayAtPropertyReservation } from "@/features/reservations";
import {
  mockGuestRepository,
  mockReservationRepository,
  mockRoomLockGateway,
} from "@/features/reservations/confirm-pay-at-property";

function icalWithEvent(uid: string, checkIn: string, checkOut: string) {
  return [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${checkIn.replaceAll("-", "")}`,
    `DTEND;VALUE=DATE:${checkOut.replaceAll("-", "")}`,
    `UID:${uid}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

describe("ingestChannelConnection", () => {
  it("creates an approved reservation for a new Airbnb event, without duplicating it on a second poll", async () => {
    const room = mockDemoRooms[0]!;
    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/ingest-1.ics",
      paymentBehavior: "auto_approved",
    });
    const document = icalWithEvent(
      "ingest-uid-1@airbnb.com",
      "2040-03-01",
      "2040-03-04"
    );

    const outboxBefore = getMockNotificationOutboxIntents().length;
    const first = await ingestChannelConnection(connection, document);
    expect(first.created).toHaveLength(1);
    expect(first.created[0]!.origin).toBe("airbnb");
    expect(first.created[0]!.externalPlatform).toBe("airbnb");
    expect(first.created[0]!.externalRef).toBe("ingest-uid-1@airbnb.com");
    expect(getMockNotificationOutboxIntents().length).toBe(outboxBefore);

    const payment = await mockReservationRepository.getPendingPayAtPropertyPaymentByReservationId?.(
      first.created[0]!.id
    );
    expect(payment).toBeNull(); // approved, not pending

    const second = await ingestChannelConnection(connection, document);
    expect(second.created).toHaveLength(0);
    expect(second.skippedExisting).toBe(1);
  });

  it("creates a pending, pay-at-property reservation for a Booking event", async () => {
    const room = mockDemoRooms[1]!;
    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "booking",
      inboundFeedUrl: "https://admin.booking.com/ical/ingest-2.ics",
      paymentBehavior: "pay_at_property",
    });
    const document = icalWithEvent(
      "ingest-uid-2@booking.com",
      "2040-04-01",
      "2040-04-03"
    );

    const result = await ingestChannelConnection(connection, document);
    expect(result.created).toHaveLength(1);
    expect(result.created[0]!.origin).toBe("booking");

    const payment = await mockReservationRepository.getPendingPayAtPropertyPaymentByReservationId?.(
      result.created[0]!.id
    );
    expect(payment?.status).toBe("pending");
  });

  it("cancels a reservation whose event disappeared from a later poll, leaving the payment untouched", async () => {
    const room = mockDemoRooms[2]!;
    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/ingest-3.ics",
      paymentBehavior: "auto_approved",
    });
    const document = icalWithEvent(
      "ingest-uid-3@airbnb.com",
      "2040-05-01",
      "2040-05-03"
    );

    const first = await ingestChannelConnection(connection, document);
    const reservationId = first.created[0]!.id;

    const emptyDocument = "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
    const second = await ingestChannelConnection(connection, emptyDocument);

    expect(second.cancelled).toHaveLength(1);
    expect(second.cancelled[0]!.id).toBe(reservationId);
    expect(second.cancelled[0]!.status).toBe("cancelled");

    const reservationAfter =
      await mockReservationRepository.getReservationById(reservationId);
    expect(reservationAfter?.status).toBe("cancelled");
  });

  it("does not insert a reservation that conflicts with an existing one, and raises an alert", async () => {
    const room = mockDemoRooms[2]!;
    const interval = createLodgingInterval("2040-06-01", "2040-06-03");

    const website = await createPayAtPropertyReservation({
      guestCandidate: {
        firstName: "Camila",
        lastName: "Soto",
        email: "camila@example.com",
        phone: "+56 9 3333 3333",
        guestCount: 1,
      },
      guestRepository: mockGuestRepository,
      interval,
      reservationRepository: mockReservationRepository,
      room,
      roomLockGateway: mockRoomLockGateway,
    });

    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "booking",
      inboundFeedUrl: "https://admin.booking.com/ical/ingest-4.ics",
      paymentBehavior: "pay_at_property",
    });
    const document = icalWithEvent(
      "ingest-uid-conflict@booking.com",
      "2040-06-01",
      "2040-06-03"
    );

    const alertsBefore = (await listChannelSyncConflictAlerts()).length;
    const result = await ingestChannelConnection(connection, document);

    expect(result.created).toHaveLength(0);
    expect(result.conflicts).toBe(1);
    expect((await listChannelSyncConflictAlerts()).length).toBe(
      alertsBefore + 1
    );

    const untouched = await mockReservationRepository.getReservationById(
      website.reservation.id
    );
    expect(untouched?.status).toBe("confirmed");
  });
});
