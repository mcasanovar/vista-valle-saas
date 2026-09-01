import { createLodgingInterval, type LodgingInterval } from "@/features/availability";

export type InboundIcalEvent = Readonly<{
  uid: string;
  interval: LodgingInterval;
}>;

function unfoldLines(document: string) {
  // RFC 5545 line folding: a continuation line starts with a single space
  // or tab and must be joined onto the previous line before parsing.
  return document.replace(/\r?\n[ \t]/g, "");
}

function extractDateValue(line: string) {
  const value = line.split(":").slice(1).join(":").trim();
  const compact = value.replace(/-/g, "").slice(0, 8);
  if (!/^\d{8}$/.test(compact)) return undefined;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

/**
 * Tolerant parser for the subset of iCal an inbound OTA feed needs: one
 * `UID`, `DTSTART`, and `DTEND` per `VEVENT`. Unknown properties (SUMMARY,
 * DESCRIPTION, custom `X-` fields, etc.) are ignored rather than rejected —
 * see `channel-calendar-sync` spec: "tolerante a campos desconocidos". A
 * `VEVENT` missing any of the three required properties, or whose dates
 * don't form a valid interval, is skipped rather than failing the whole
 * document.
 */
export function parseInboundIcalEvents(
  document: string
): readonly InboundIcalEvent[] {
  const unfolded = unfoldLines(document);
  const blocks = unfolded.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

  const events: InboundIcalEvent[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim());
    let uid: string | undefined;
    let checkIn: string | undefined;
    let checkOut: string | undefined;

    for (const line of lines) {
      if (line.startsWith("UID")) {
        uid = line.split(":").slice(1).join(":").trim();
      } else if (line.startsWith("DTSTART")) {
        checkIn = extractDateValue(line);
      } else if (line.startsWith("DTEND")) {
        checkOut = extractDateValue(line);
      }
    }

    if (!uid || !checkIn || !checkOut) continue;
    try {
      events.push(
        Object.freeze({ uid, interval: createLodgingInterval(checkIn, checkOut) })
      );
    } catch {
      // Invalid/inverted interval: skip this event rather than fail the poll.
    }
  }

  return Object.freeze(events);
}
