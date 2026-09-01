import { describe, expect, it } from "vitest";
import { createLodgingInterval } from "@/features/availability";
import { generateOutboundIcalDocument } from "@/features/channel-calendar-sync/outbound-feed";

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
      "airbnb"
    );
    expect(document).not.toContain("airbnb-origin-reservation");
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
      "airbnb"
    );
    expect(document).toContain("website-reservation");
    expect(document).toContain("pending-hold");
    expect(document).toContain("manual-block");
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
    const bookingFeed = generateOutboundIcalDocument(entries, "booking");
    expect(bookingFeed).not.toContain("booking-origin-reservation");
    expect(bookingFeed).toContain("airbnb-origin-reservation");

    const airbnbFeed = generateOutboundIcalDocument(entries, "airbnb");
    expect(airbnbFeed).toContain("booking-origin-reservation");
    expect(airbnbFeed).not.toContain("airbnb-origin-reservation");
  });

  it("returns a valid empty calendar when nothing is occupied", () => {
    const document = generateOutboundIcalDocument([], "booking");
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
});
