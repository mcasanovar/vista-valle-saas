import { describe, expect, it } from "vitest";
import {
  createLodgingInterval,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import { mockDemoRooms } from "@/features/rooms";
import { createPayAtPropertyReservation } from "@/features/reservations";
import {
  getMockNotificationOutboxRepository,
  getNotificationOutboxWriter,
} from "@/features/notifications";
import { getOperationalAlerts } from "@/features/admin/operational-alerts";
import {
  mockGuestRepository,
  mockReservationRepository,
  mockRoomLockGateway,
} from "@/features/reservations/confirm-pay-at-property";
describe("operational alerts", () => {
  it("shows safe payment and notification alerts without PII", async () => {
    await createPayAtPropertyReservation({
      guestCandidate: {
        firstName: "Ana",
        lastName: "Pérez",
        email: "secret@example.com",
        phone: "123",
        guestCount: 1,
      },
      guestRepository: mockGuestRepository,
      interval: createLodgingInterval("2040-01-01", "2040-01-03"),
      notificationOutboxWriter:
        getNotificationOutboxWriter<MockRoomLockOperationContext>() ??
        undefined,
      reservationRepository: mockReservationRepository,
      room: mockDemoRooms[0],
      roomLockGateway: mockRoomLockGateway,
    });

    // `notification_failure` now comes from the real mock outbox instead of
    // a hardcoded demo item, so this simulates a delivery that failed for
    // good (no retryAt).
    const outbox = getMockNotificationOutboxRepository()!;
    const [pendingIntent] = outbox.list();
    outbox.startDelivery(pendingIntent!.id, new Date());
    outbox.failDelivery(pendingIntent!.id, {
      errorCode: "delivery_permanent",
      now: new Date(),
    });

    const alerts = await getOperationalAlerts();
    const text = JSON.stringify(alerts);
    expect(text).toContain("notification_failure");
    expect(text).toContain("payment_pending");
    expect(text).not.toContain("secret@example.com");
    expect(text).not.toContain("externalReference");
    expect(text).not.toContain("provider");
  });
});
