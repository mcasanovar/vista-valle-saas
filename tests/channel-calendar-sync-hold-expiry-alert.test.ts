import { describe, expect, it } from "vitest";
import {
  confirmPayNowReservationFromHold,
  createMockHoldRepository,
  createMockReservationRepository,
  HoldExpiredError,
} from "@/features/reservations";
import { createLodgingInterval, createMockRoomLockGateway } from "@/features/availability";
import {
  listChannelSyncConflictAlerts,
  raiseConflictAlertForExpiredHold,
} from "@/features/channel-calendar-sync";

function pricing(roomId: string) {
  return {
    chargesClp: 0,
    nightlyPriceClp: 60_000,
    nights: 2,
    roomId,
    totalClp: 120_000,
  };
}

describe("raiseConflictAlertForExpiredHold", () => {
  it("records the shared conflict alert using the hold's room", async () => {
    const holdRepository = createMockHoldRepository();
    const roomLockGateway = createMockRoomLockGateway();
    const interval = createLodgingInterval("2041-01-01", "2041-01-03");
    const hold = await roomLockGateway.runExclusive(
      "room-hold-expiry-alert",
      interval,
      (context) =>
        holdRepository.createHold(context, {
          checkIn: interval.checkIn,
          checkOut: interval.checkOut,
          expiresAt: new Date(Date.now() - 60_000),
          guestCount: 1,
          guestId: "guest-hold-expiry-alert",
          pricing: pricing("room-hold-expiry-alert"),
          roomId: "room-hold-expiry-alert",
        })
    );

    const before = listChannelSyncConflictAlerts().length;
    await raiseConflictAlertForExpiredHold(hold.id, holdRepository);
    const alerts = listChannelSyncConflictAlerts();

    expect(alerts.length).toBe(before + 1);
    expect(alerts[alerts.length - 1]!.roomId).toBe("room-hold-expiry-alert");
  });

  it("does nothing when the hold no longer exists", async () => {
    const holdRepository = createMockHoldRepository();
    const before = listChannelSyncConflictAlerts().length;
    await raiseConflictAlertForExpiredHold("does-not-exist", holdRepository);
    expect(listChannelSyncConflictAlerts().length).toBe(before);
  });
});

describe("confirmPayNowReservationFromHold", () => {
  it("throws HoldExpiredError (the error the webhook route alerts on) for an expired hold", async () => {
    const holdRepository = createMockHoldRepository();
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const interval = createLodgingInterval("2041-02-01", "2041-02-03");
    const hold = await roomLockGateway.runExclusive(
      "room-hold-expiry-flow",
      interval,
      (context) =>
        holdRepository.createHold(context, {
          checkIn: interval.checkIn,
          checkOut: interval.checkOut,
          expiresAt: new Date(Date.now() - 1_000),
          guestCount: 1,
          guestId: "guest-hold-expiry-flow",
          pricing: pricing("room-hold-expiry-flow"),
          roomId: "room-hold-expiry-flow",
        })
    );

    await expect(
      confirmPayNowReservationFromHold({
        hold,
        holdRepository,
        paymentExternalReference: "ext-ref",
        paymentId: "payment-id",
        providerPaymentId: "provider-payment-id",
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(HoldExpiredError);
  });
});
