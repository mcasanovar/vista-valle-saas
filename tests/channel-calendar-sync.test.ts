import { describe, expect, it } from "vitest";
import { getChannelConnections } from "@/features/channel-calendar-sync";
import { mockDemoRooms } from "@/features/rooms";

describe("channel connections (mock adapter)", () => {
  it("creates a connection without exposing the inbound feed URL", () => {
    const connections = getChannelConnections()!;
    const created = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[0]!.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/example.ics",
      paymentBehavior: "auto_approved",
    });
    expect(created).not.toHaveProperty("inboundFeedUrl");
    expect(created.hasInboundFeedUrl).toBe(true);
    expect(JSON.stringify(created)).not.toContain("airbnb.com/calendar");
  });

  it("regenerates the outbound token, invalidating the previous one", () => {
    const connections = getChannelConnections()!;
    const created = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[1]!.id,
      platform: "booking",
      inboundFeedUrl: "https://admin.booking.com/ical/example.ics",
      paymentBehavior: "pay_at_property",
    });
    const previousToken = created.outboundToken;
    const regenerated = connections.regenerateOutboundToken(created.id);
    expect(regenerated.outboundToken).not.toBe(previousToken);
    expect(
      connections.getByOutboundToken(previousToken)
    ).toBeNull();
    expect(connections.getByOutboundToken(regenerated.outboundToken)).toEqual(
      regenerated
    );
  });

  it("records poll results without opening any network connection", () => {
    const connections = getChannelConnections()!;
    const created = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[2]!.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/other.ics",
      paymentBehavior: "auto_approved",
    });
    const enabled = connections.setEnabled(created.id, true);
    expect(enabled.enabled).toBe(true);
    const polled = connections.recordPollResult({
      connectionId: created.id,
      status: "ok",
      eventCount: 2,
    });
    expect(polled.lastPollStatus).toBe("ok");
    expect(polled.lastPollEventCount).toBe(2);
    expect(connections.listActive().some((c) => c.id === created.id)).toBe(
      true
    );
  });
});
