import { describe, expect, it } from "vitest";

import { GET } from "../app/api/ical/[token]/route";
import { createLodgingInterval } from "@/features/availability";
import { getChannelConnections } from "@/features/channel-calendar-sync";
import { mockDemoRooms } from "@/features/rooms";
import { createRoomBlock } from "@/features/room-blocks/manual-blocks";
import { createPayAtPropertyReservation } from "@/features/reservations";
import {
  mockGuestRepository,
  mockReservationRepository,
  mockRoomLockGateway,
} from "@/features/reservations/confirm-pay-at-property";

describe("GET /api/ical/[token]", () => {
  it("responds 404 without occupancy data for an unknown token", async () => {
    const response = await GET(
      new Request("http://localhost/api/ical/does-not-exist"),
      { params: Promise.resolve({ token: "does-not-exist" }) }
    );
    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).not.toContain("BEGIN:VCALENDAR");
  });

  it("serves a valid calendar document for a known token", async () => {
    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[0]!.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/route-test.ics",
      paymentBehavior: "auto_approved",
    });

    const response = await GET(
      new Request(`http://localhost/api/ical/${connection.outboundToken}`),
      { params: Promise.resolve({ token: connection.outboundToken }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/calendar");
    const text = await response.text();
    expect(text.startsWith("BEGIN:VCALENDAR")).toBe(true);
  });

  it("reflects a reservation created immediately before the request, with no cache", async () => {
    const room = mockDemoRooms[2]!;
    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "booking",
      inboundFeedUrl: "https://admin.booking.com/ical/route-test.ics",
      paymentBehavior: "pay_at_property",
    });

    const first = await GET(
      new Request(`http://localhost/api/ical/${connection.outboundToken}`),
      { params: Promise.resolve({ token: connection.outboundToken }) }
    );
    expect(await first.text()).not.toContain("DTSTART;VALUE=DATE:20390501");

    await createPayAtPropertyReservation({
      guestCandidate: {
        firstName: "Sofía",
        lastName: "Reyes",
        email: "sofia@example.com",
        phone: "+56 9 2222 2222",
        guestCount: 1,
      },
      guestRepository: mockGuestRepository,
      interval: createLodgingInterval("2039-05-01", "2039-05-03"),
      reservationRepository: mockReservationRepository,
      room,
      roomLockGateway: mockRoomLockGateway,
    });

    const second = await GET(
      new Request(`http://localhost/api/ical/${connection.outboundToken}`),
      { params: Promise.resolve({ token: connection.outboundToken }) }
    );
    const text = await second.text();
    expect(text).toContain("DTSTART;VALUE=DATE:20390501");
    expect(text).toContain("DTEND;VALUE=DATE:20390503");
  });

  it("reflects a room block created through the admin flow", async () => {
    const room = mockDemoRooms[1]!;
    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/block-test.ics",
      paymentBehavior: "auto_approved",
    });

    await createRoomBlock(
      {
        roomId: room.id,
        checkIn: "2042-05-01",
        checkOut: "2042-05-03",
        reason: "Prueba de feed iCal",
      },
      "test-admin"
    );

    const response = await GET(
      new Request(`http://localhost/api/ical/${connection.outboundToken}`),
      { params: Promise.resolve({ token: connection.outboundToken }) }
    );
    const text = await response.text();

    expect(text).toContain("DTSTART;VALUE=DATE:20420501");
    expect(text).toContain("DTEND;VALUE=DATE:20420503");
  });
});
