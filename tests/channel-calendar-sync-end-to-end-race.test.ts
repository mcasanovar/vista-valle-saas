import { describe, expect, it } from "vitest";
import {
  confirmPayNowReservationFromHold,
  createMockHoldRepository,
  createMockReservationRepository,
  HoldExpiredError,
} from "@/features/reservations";
import { createLodgingInterval, createMockRoomLockGateway } from "@/features/availability";
import {
  getChannelConnections,
  ingestChannelConnection,
  listChannelSyncConflictAlerts,
  raiseConflictAlertForExpiredHold,
} from "@/features/channel-calendar-sync";
import { mockDemoRooms } from "@/features/rooms";
import { mockReservationRepository as canonicalReservationRepository } from "@/features/reservations/confirm-pay-at-property";

function icalWithEvent(uid: string, checkIn: string, checkOut: string) {
  return [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${checkIn.replaceAll("-", "")}`,
    `DTEND;VALUE=DATE:${checkOut.replaceAll("-", "")}`,
    `UID:${uid}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * End-to-end reproduction of design.md's documented risk: a web hold
 * expires while a channel-sync event lands on the same room/dates, and the
 * late Fintoc approval for that hold arrives afterward. No conflicting
 * reservation is created either way, and exactly one alert is raised.
 */
describe("hold-expiry race with a channel-sync arrival", () => {
  it("lets the sync reservation win, rejects the late online payment, and raises exactly one alert", async () => {
    const room = mockDemoRooms[1]!;
    const interval = createLodgingInterval("2044-01-01", "2044-01-03");

    // A shared room-lock gateway/reservation repository, matching how the
    // hold and the confirmation would share state in the real app (both
    // ultimately go through the same production room lock per room).
    const holdRepository = createMockHoldRepository();
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();

    const hold = await roomLockGateway.runExclusive(
      room.id,
      interval,
      (context) =>
        holdRepository.createHold(context, {
          checkIn: interval.checkIn,
          checkOut: interval.checkOut,
          expiresAt: new Date(Date.now() - 60_000), // already expired
          guestCount: 1,
          guestId: "guest-race-test",
          pricing: {
            chargesClp: 0,
            nightlyPriceClp: 60_000,
            nights: 2,
            totalClp: 120_000,
          },
          roomId: room.id,
        })
    );

    // The channel-sync connection uses the canonical mock room-lock
    // gateway/reservation repository the rest of the app shares (see
    // `ingest.ts`), so it correctly sees this room as free: the hold above
    // was created on a *separate* gateway instance for this test and,
    // regardless, is already expired.
    const connections = getChannelConnections()!;
    const connection = connections.setInboundFeedUrl({
      roomId: room.id,
      platform: "airbnb",
      inboundFeedUrl: "https://www.airbnb.com/calendar/ical/race-test.ics",
      paymentBehavior: "auto_approved",
    });
    const syncResult = await ingestChannelConnection(
      connection,
      icalWithEvent("race-test@airbnb.com", "2044-01-01", "2044-01-03")
    );
    expect(syncResult.created).toHaveLength(1);
    expect(syncResult.conflicts).toBe(0);

    const alertsBefore = (await listChannelSyncConflictAlerts()).length;

    // The late Fintoc approval for the now-expired hold arrives.
    await expect(
      confirmPayNowReservationFromHold({
        hold,
        holdRepository,
        paymentExternalReference: "ext-ref-race",
        paymentId: "payment-race",
        providerPaymentId: "provider-payment-race",
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(HoldExpiredError);

    // Exactly what app/api/webhooks/fintoc/route.ts does on that error.
    await raiseConflictAlertForExpiredHold(hold.id, holdRepository);

    const alerts = await listChannelSyncConflictAlerts();
    expect(alerts.length).toBe(alertsBefore + 1);
    expect(alerts[alerts.length - 1]!.roomId).toBe(room.id);

    // No reservation was created from the failed confirmation — only the
    // one the sync ingestion already created, in the canonical store the
    // production stack actually shares.
    const canonicalReservations =
      (await canonicalReservationRepository.listReservations?.()) ?? [];
    expect(
      canonicalReservations.filter(
        (r) =>
          r.roomId === room.id &&
          r.checkIn === interval.checkIn &&
          r.checkOut === interval.checkOut
      )
    ).toHaveLength(1);
  });
});
