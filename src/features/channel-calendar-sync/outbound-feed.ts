import { createHmac } from "node:crypto";

import type { LodgingDate, LodgingInterval } from "@/features/availability";
import type { ChannelPlatform } from "./connections";

/**
 * Persistence-agnostic shape of one occupied interval to publish, already
 * resolved with the originating reservation's `origin` when the source is a
 * reservation (see design.md decision 6: the outbound feed is computed on
 * the fly from the same occupancy that already feeds availability, no
 * caching). `origin` is absent for holds and blocks, which never originate
 * from an external channel and are therefore always published.
 */
export type ChannelFeedOccupancyEntry = Readonly<{
  interval: LodgingInterval;
  source: "reservation" | "hold" | "block";
  sourceId: string;
  origin?: string;
}>;

function toCompactDate(date: LodgingDate) {
  return date.replaceAll("-", "");
}

function toUtcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcalText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Derives a stable but opaque event UID for one occupancy entry
 * (harden-admin-authentication, task 9.2): the outbound feed's UID used to
 * be `${source}-${sourceId}`, publishing the exact internal UUID that the
 * mutation cores (`transitionAdminReservationWithResult` and friends)
 * accept as an identifier. HMAC-SHA256 keyed by the connection's own
 * `outboundToken` makes the id unguessable without that token, stable
 * across regenerations of the same feed (same token, same source/sourceId
 * in → same UID out), and different per connection (each has its own
 * token) — all without storing anything new.
 */
function opaqueEventId(
  outboundToken: string,
  source: string,
  sourceId: string
): string {
  return createHmac("sha256", outboundToken)
    .update(`${source}:${sourceId}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Builds the `.ics` document a given `platform` will import for one
 * connection, excluding reservations whose `origin` equals `platform` (the
 * spec's "Publicación de feed saliente por habitación": never echo a
 * platform's own reservations back to it). Holds and blocks have no
 * `origin` and are always included.
 */
export function generateOutboundIcalDocument(
  entries: readonly ChannelFeedOccupancyEntry[],
  platform: ChannelPlatform,
  outboundToken: string,
  now: () => Date = () => new Date()
): string {
  const dtstamp = toUtcStamp(now());
  const published = entries.filter((entry) => entry.origin !== platform);

  const events = published
    .map((entry) =>
      [
        "BEGIN:VEVENT",
        `UID:${opaqueEventId(outboundToken, entry.source, entry.sourceId)}@vistavallehospedaje.com`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${toCompactDate(entry.interval.checkIn)}`,
        `DTEND;VALUE=DATE:${toCompactDate(entry.interval.checkOut)}`,
        `SUMMARY:${escapeIcalText("Reservado")}`,
        "END:VEVENT",
      ].join("\r\n")
    )
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vista Valle//Channel Calendar Sync//ES",
    "CALSCALE:GREGORIAN",
    ...(events ? [events] : []),
    "END:VCALENDAR",
  ].join("\r\n");
}
