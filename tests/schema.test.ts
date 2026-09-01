import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  amenities,
  assistantInteractions,
  auditEvents,
  channelSyncTasks,
  guests,
  notificationOutbox,
  paymentEvents,
  payments,
  reservationOriginEnum,
  reservationHolds,
  reservationItems,
  reservationStatusEnum,
  reservations,
  roomBlocks,
  roomAmenities,
  roomImages,
  rooms,
} from "@/persistence";

describe("offline persistence schema", () => {
  it("defines the required tables without opening a connection", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    expect([
      getTableName(rooms),
      getTableName(roomImages),
      getTableName(amenities),
      getTableName(roomAmenities),
      getTableName(guests),
      getTableName(reservations),
      getTableName(reservationItems),
      getTableName(reservationHolds),
      getTableName(roomBlocks),
      getTableName(payments),
      getTableName(paymentEvents),
      getTableName(channelSyncTasks),
      getTableName(auditEvents),
      getTableName(notificationOutbox),
      getTableName(assistantInteractions),
    ]).toEqual([
      "rooms",
      "room_images",
      "amenities",
      "room_amenities",
      "guests",
      "reservations",
      "reservation_items",
      "reservation_holds",
      "room_blocks",
      "payments",
      "payment_events",
      "channel_sync_tasks",
      "audit_events",
      "notification_outbox",
      "assistant_interactions",
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses date-only lodging intervals, UTC event timestamps, and integer CLP", () => {
    expect(reservations.checkIn.columnType).toBe("PgDateString");
    expect(reservations.checkOut.columnType).toBe("PgDateString");
    expect(reservationItems.subtotalClp.dataType).toBe("number");
    expect(reservations.invoiceRequested.notNull).toBe(true);
    expect(reservationHolds.expiresAt.columnType).toBe("PgTimestamp");
    expect(roomBlocks.checkOut.columnType).toBe("PgDateString");
    expect(payments.amountClp.dataType).toBe("number");
    expect(paymentEvents.occurredAt.dataType).toBe("date");
    expect(
      (paymentEvents.occurredAt as unknown as { withTimezone: boolean })
        .withTimezone
    ).toBe(true);
    expect(reservationHolds.totalClp.dataType).toBe("number");
    expect(notificationOutbox.idempotencyKey.notNull).toBe(true);
    expect(reservationStatusEnum.enumValues).toEqual([
      "confirmed",
      "cancelled",
      "completed",
      "no_show",
    ]);
    expect(reservationOriginEnum.enumValues).toContain("website");
  });
});
