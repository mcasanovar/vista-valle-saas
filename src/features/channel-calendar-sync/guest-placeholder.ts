import type { ChannelPlatform } from "./connections";

const platformLastName: Record<ChannelPlatform, string> = {
  airbnb: "Airbnb",
  booking: "Booking",
};

/**
 * Fixed, deliberately non-real guest identity for a reservation created
 * from an inbound channel-sync event (see `channel-calendar-sync` spec:
 * "Datos de huésped de reservas sincronizadas"). The inbound feed carries
 * no guest PII by design (OTA privacy policy), so this satisfies the
 * existing guest validation (`guest.ts`) without relaxing the schema —
 * design.md decision 4. `guestCount` defaults to 1: the feed carries no
 * occupancy count either, and 1 always fits within any room's capacity.
 */
export function createChannelSyncGuestCandidate(platform: ChannelPlatform) {
  const randomDigits = crypto
    .getRandomValues(new Uint32Array(1))[0]!
    .toString()
    .padStart(10, "0")
    .slice(0, 8);
  return Object.freeze({
    firstName: "Huesped",
    lastName: platformLastName[platform],
    email: "vistavallespa@gmail.com",
    phone: `+56 9 ${randomDigits.slice(0, 4)} ${randomDigits.slice(4, 8)}`,
    guestCount: 1,
  });
}
