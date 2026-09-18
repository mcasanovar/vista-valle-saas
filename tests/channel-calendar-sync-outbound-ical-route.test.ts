import { describe, expect, it } from "vitest";

import { GET } from "../app/api/ical/[token]/route";
import { getChannelConnections } from "@/features/channel-calendar-sync/connections";
import { mockDemoRooms } from "@/features/rooms";

function requestFor(token: string) {
  return GET(new Request(`http://localhost/api/ical/${token}`), {
    params: Promise.resolve({ token }),
  });
}

describe("GET /api/ical/[token]", () => {
  it("returns 404 for an unknown token", async () => {
    const response = await requestFor("unknown-token");
    expect(response.status).toBe(404);
  });

  it("serves the outbound feed for an active, unpaused connection", async () => {
    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[0]!.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/outbound.ics",
      paymentBehavior: "auto_approved",
    });
    connections.setEnabled(connection.id, true);

    const response = await requestFor(connection.outboundToken);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/calendar");
  });

  it("returns 404 for a connection whose platform is paused", async () => {
    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[1]!.id,
      platform: "booking",
      inboundFeedUrl: "https://admin.booking.com/ical/outbound-paused.ics",
      paymentBehavior: "pay_at_property",
    });
    connections.setEnabled(connection.id, true);

    connections.setPlatformPaused("booking", true);
    try {
      const response = await requestFor(connection.outboundToken);
      expect(response.status).toBe(404);
    } finally {
      connections.setPlatformPaused("booking", false);
    }
  });

  it("serves the feed again once the platform is resumed", async () => {
    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[2]!.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/resume.ics",
      paymentBehavior: "auto_approved",
    });
    connections.setEnabled(connection.id, true);

    connections.setPlatformPaused("airbnb", true);
    expect((await requestFor(connection.outboundToken)).status).toBe(404);

    connections.setPlatformPaused("airbnb", false);
    expect((await requestFor(connection.outboundToken)).status).toBe(200);
  });
});
