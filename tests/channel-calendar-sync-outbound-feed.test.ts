import { describe, expect, it } from "vitest";
import { createLodgingInterval } from "@/features/availability";
import { generateOutboundIcalDocument } from "@/features/channel-calendar-sync/outbound-feed";

const token = "outbound-token-for-connection-a";
const otherToken = "outbound-token-for-connection-b";

function uidsIn(document: string): string[] {
  return [...document.matchAll(/^UID:(.+)$/gm)].map((match) => match[1]!);
}

describe("generateOutboundIcalDocument", () => {
  it("excludes a reservation whose origin matches the requesting platform", () => {
    const document = generateOutboundIcalDocument(
      [
        {
          interval: createLodgingInterval("2026-11-01", "2026-11-03"),
          source: "reservation",
          sourceId: "airbnb-origin-reservation",
          origin: "airbnb",
        },
      ],
      "airbnb",
      token
    );
    expect(uidsIn(document)).toHaveLength(0);
    expect(document.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(document.trim().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("includes reservations from other origins, and holds/blocks with no origin", () => {
    const document = generateOutboundIcalDocument(
      [
        {
          interval: createLodgingInterval("2026-11-01", "2026-11-03"),
          source: "reservation",
          sourceId: "website-reservation",
          origin: "website",
        },
        {
          interval: createLodgingInterval("2026-12-01", "2026-12-02"),
          source: "hold",
          sourceId: "pending-hold",
        },
        {
          interval: createLodgingInterval("2027-01-01", "2027-01-02"),
          source: "block",
          sourceId: "manual-block",
        },
      ],
      "airbnb",
      token
    );
    expect(uidsIn(document)).toHaveLength(3);
    expect(document).toContain("DTSTART;VALUE=DATE:20261101");
    expect(document).toContain("DTEND;VALUE=DATE:20261103");
  });

  it("applies the same origin-exclusion rule to a Booking connection, proving the mechanism isn't Airbnb-specific", () => {
    const entries = [
      {
        interval: createLodgingInterval("2028-01-01", "2028-01-03"),
        source: "reservation" as const,
        sourceId: "booking-origin-reservation",
        origin: "booking",
      },
      {
        interval: createLodgingInterval("2028-02-01", "2028-02-03"),
        source: "reservation" as const,
        sourceId: "airbnb-origin-reservation",
        origin: "airbnb",
      },
    ];
    const bookingFeed = generateOutboundIcalDocument(entries, "booking", token);
    expect(uidsIn(bookingFeed)).toHaveLength(1);

    const airbnbFeed = generateOutboundIcalDocument(entries, "airbnb", token);
    expect(uidsIn(airbnbFeed)).toHaveLength(1);
    expect(uidsIn(airbnbFeed)[0]).not.toBe(uidsIn(bookingFeed)[0]);
  });

  it("returns a valid empty calendar when nothing is occupied", () => {
    const document = generateOutboundIcalDocument([], "booking", token);
    expect(document).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Vista Valle//Channel Calendar Sync//ES",
        "CALSCALE:GREGORIAN",
        "END:VCALENDAR",
      ].join("\r\n")
    );
  });

  it("publishes an opaque event UID that never contains the internal source id (harden-admin-authentication, task 9.2)", () => {
    const document = generateOutboundIcalDocument(
      [
        {
          interval: createLodgingInterval("2026-11-01", "2026-11-03"),
          source: "reservation",
          sourceId: "11111111-1111-4111-8111-111111111111",
          origin: "website",
        },
      ],
      "airbnb",
      token
    );
    expect(document).not.toContain("11111111-1111-4111-8111-111111111111");
    const [uid] = uidsIn(document);
    expect(uid).toMatch(/^[0-9a-f]{32}@vistavallehospedaje\.com$/);
  });

  it("is stable across two generations of the same feed, and differs between feeds (different tokens)", () => {
    const entry = {
      interval: createLodgingInterval("2026-11-01", "2026-11-03"),
      source: "reservation" as const,
      sourceId: "11111111-1111-4111-8111-111111111111",
      origin: "website",
    };

    const first = generateOutboundIcalDocument([entry], "airbnb", token);
    const second = generateOutboundIcalDocument([entry], "airbnb", token);
    expect(uidsIn(first)[0]).toBe(uidsIn(second)[0]);

    const otherConnection = generateOutboundIcalDocument(
      [entry],
      "airbnb",
      otherToken
    );
    expect(uidsIn(otherConnection)[0]).not.toBe(uidsIn(first)[0]);
  });
});
