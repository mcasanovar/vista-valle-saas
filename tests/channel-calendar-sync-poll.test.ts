import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../app/api/internal/channel-sync/poll/route";
import { getChannelConnections } from "@/features/channel-calendar-sync/connections";
import { pollAllActiveConnections } from "@/features/channel-calendar-sync/poll";
import { mockDemoRooms } from "@/features/rooms";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/internal/channel-sync/poll", () => {
  it("responds 401 when no secret is configured", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/channel-sync/poll", {
        method: "POST",
      })
    );
    expect(response.status).toBe(401);
  });

  it("responds 401 with the wrong bearer token even when a secret is configured", async () => {
    vi.stubEnv(
      "CHANNEL_SYNC_PROCESSOR_SECRET",
      "a".repeat(32)
    );
    const response = await POST(
      new Request("http://localhost/api/internal/channel-sync/poll", {
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      })
    );
    expect(response.status).toBe(401);
  });

  it("responds 200 with the correct bearer token", async () => {
    vi.stubEnv("CHANNEL_SYNC_PROCESSOR_SECRET", "b".repeat(32));
    const response = await POST(
      new Request("http://localhost/api/internal/channel-sync/poll", {
        method: "POST",
        headers: { authorization: `Bearer ${"b".repeat(32)}` },
      })
    );
    expect(response.status).toBe(200);
  });
});

describe("pollAllActiveConnections", () => {
  it("records a poll result per active connection and continues after one fails", async () => {
    const connections = getChannelConnections()!;
    const ok = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[0]!.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/poll-ok.ics",
      paymentBehavior: "auto_approved",
    });
    connections.setEnabled(ok.id, true);

    const broken = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[1]!.id,
      platform: "booking",
      inboundFeedUrl: "https://admin.booking.com/ical/poll-broken.ics",
      paymentBehavior: "pay_at_property",
    });
    connections.setEnabled(broken.id, true);

    const outcomes = await pollAllActiveConnections(async (url) => {
      if (url.includes("poll-broken")) throw new Error("network down");
      return "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
    });

    const okOutcome = outcomes.find((o) => o.connectionId === ok.id);
    const brokenOutcome = outcomes.find((o) => o.connectionId === broken.id);
    expect(okOutcome?.status).toBe("ok");
    expect(brokenOutcome?.status).toBe("error");
    expect(brokenOutcome?.error).toContain("network down");

    expect(
      connections.getByRoomAndPlatform(mockDemoRooms[0]!.id, "airbnb")
        ?.lastPollStatus
    ).toBe("ok");
    expect(
      connections.getByRoomAndPlatform(mockDemoRooms[1]!.id, "booking")
        ?.lastPollStatus
    ).toBe("error");
  });

  it("skips every connection of a paused platform without touching its enabled state", async () => {
    const connections = getChannelConnections()!;
    const paused = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[2]!.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/paused.ics",
      paymentBehavior: "auto_approved",
    });
    connections.setEnabled(paused.id, true);

    connections.setPlatformPaused("airbnb", true);
    try {
      const outcomes = await pollAllActiveConnections(async () =>
        "BEGIN:VCALENDAR\r\nEND:VCALENDAR"
      );
      const outcome = outcomes.find((o) => o.connectionId === paused.id);
      expect(outcome?.status).toBe("skipped");
      expect(
        connections.getByRoomAndPlatform(mockDemoRooms[2]!.id, "airbnb")
          ?.enabled
      ).toBe(true);
      expect(connections.isPlatformPaused("airbnb")).toBe(true);
    } finally {
      connections.setPlatformPaused("airbnb", false);
    }
  });

  it("polling the other platform is unaffected while one platform is paused", async () => {
    const connections = getChannelConnections()!;
    const airbnbConnection = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[1]!.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/other.ics",
      paymentBehavior: "auto_approved",
    });
    connections.setEnabled(airbnbConnection.id, true);
    const bookingConnection = connections.setInboundFeedUrl({
      roomId: mockDemoRooms[0]!.id,
      platform: "booking",
      inboundFeedUrl: "https://admin.booking.com/ical/other.ics",
      paymentBehavior: "pay_at_property",
    });
    connections.setEnabled(bookingConnection.id, true);

    connections.setPlatformPaused("airbnb", true);
    try {
      const outcomes = await pollAllActiveConnections(async () =>
        "BEGIN:VCALENDAR\r\nEND:VCALENDAR"
      );
      expect(
        outcomes.find((o) => o.connectionId === airbnbConnection.id)?.status
      ).toBe("skipped");
      expect(
        outcomes.find((o) => o.connectionId === bookingConnection.id)?.status
      ).toBe("ok");
    } finally {
      connections.setPlatformPaused("airbnb", false);
    }
  });
});
