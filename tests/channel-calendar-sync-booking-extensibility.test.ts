import { describe, expect, it } from "vitest";

import { GET } from "../app/api/ical/[token]/route";
import { getChannelConnections } from "@/features/channel-calendar-sync/connections";
import { ingestChannelConnection } from "@/features/channel-calendar-sync/ingest";
import { mockDemoRooms } from "@/features/rooms";
import { mockReservationRepository } from "@/features/reservations/confirm-pay-at-property";

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

/**
 * Proves design.md decision 1 end-to-end: adding Booking is only
 * configuration (a second `channel_connections` row with a different
 * `paymentBehavior`), not a second code path. Both connections share one
 * room to also confirm they don't interfere with each other.
 */
describe("Booking connection, registered with the same mechanism as Airbnb", () => {
  it("ingests a Booking event as a pending reservation and an Airbnb event as approved, on the same room", async () => {
    const room = mockDemoRooms[0]!;
    const connections = getChannelConnections()!;

    const airbnbConnection = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/ext-test.ics",
      paymentBehavior: "auto_approved",
    });
    const bookingConnection = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "booking",
      inboundFeedUrl: "https://admin.booking.com/ical/ext-test.ics",
      paymentBehavior: "pay_at_property",
    });

    const airbnbResult = await ingestChannelConnection(
      airbnbConnection,
      icalWithEvent("ext-airbnb@airbnb.com", "2042-01-01", "2042-01-03")
    );
    const bookingResult = await ingestChannelConnection(
      bookingConnection,
      icalWithEvent("ext-booking@booking.com", "2042-02-01", "2042-02-03")
    );

    expect(airbnbResult.created).toHaveLength(1);
    expect(bookingResult.created).toHaveLength(1);

    const airbnbPayment =
      await mockReservationRepository.getPendingPayAtPropertyPaymentByReservationId?.(
        airbnbResult.created[0]!.id
      );
    const bookingPayment =
      await mockReservationRepository.getPendingPayAtPropertyPaymentByReservationId?.(
        bookingResult.created[0]!.id
      );
    expect(airbnbPayment).toBeNull(); // approved
    expect(bookingPayment?.status).toBe("pending");

    // Each connection's own outbound feed excludes only its own platform.
    const airbnbFeed = await (
      await GET(
        new Request(`http://localhost/api/ical/${airbnbConnection.outboundToken}`),
        { params: Promise.resolve({ token: airbnbConnection.outboundToken }) }
      )
    ).text();
    const bookingFeed = await (
      await GET(
        new Request(`http://localhost/api/ical/${bookingConnection.outboundToken}`),
        { params: Promise.resolve({ token: bookingConnection.outboundToken }) }
      )
    ).text();

    const airbnbReservationId = airbnbResult.created[0]!.id;
    const bookingReservationId = bookingResult.created[0]!.id;

    expect(airbnbFeed).not.toContain(airbnbReservationId);
    expect(airbnbFeed).toContain(bookingReservationId);
    expect(bookingFeed).not.toContain(bookingReservationId);
    expect(bookingFeed).toContain(airbnbReservationId);
  });
});
