import { describe, expect, it } from "vitest";
import { parseInboundIcalEvents } from "@/features/channel-calendar-sync/inbound-parser";

describe("parseInboundIcalEvents", () => {
  it("extracts uid and interval from a well-formed feed", () => {
    const document = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20261101",
      "DTEND;VALUE=DATE:20261103",
      "DTSTAMP:20260901T120000Z",
      "UID:abc123@airbnb.com",
      "SUMMARY:Reserved",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseInboundIcalEvents(document);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      uid: "abc123@airbnb.com",
      interval: { checkIn: "2026-11-01", checkOut: "2026-11-03" },
    });
  });

  it("skips a VEVENT missing UID/DTSTART/DTEND instead of throwing, and ignores unknown fields", () => {
    const document = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "X-CUSTOM-FIELD:something unexpected",
      "DTSTART;VALUE=DATE:20261201",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20270101",
      "DTEND;VALUE=DATE:20270103",
      "UID:complete@airbnb.com",
      "X-ANOTHER-UNKNOWN:ignored",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseInboundIcalEvents(document);
    expect(events).toHaveLength(1);
    expect(events[0]!.uid).toBe("complete@airbnb.com");
  });

  it("handles folded (continuation) lines per RFC 5545", () => {
    const document = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20261101",
      "DTEND;VALUE=DATE:20261103",
      "UID:folded-uid-part-one",
      " -continued@airbnb.com",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const events = parseInboundIcalEvents(document);
    expect(events).toHaveLength(1);
    expect(events[0]!.uid).toBe("folded-uid-part-one-continued@airbnb.com");
  });

  it("returns no events for a document with no VEVENT blocks", () => {
    expect(parseInboundIcalEvents("BEGIN:VCALENDAR\r\nEND:VCALENDAR")).toEqual(
      []
    );
  });
});
