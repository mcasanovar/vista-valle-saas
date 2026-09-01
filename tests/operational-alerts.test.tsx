import { describe, expect, it } from "vitest";
import { createLodgingInterval } from "@/features/availability";
import { mockDemoRooms } from "@/features/rooms";
import { createPayAtPropertyReservation } from "@/features/reservations";
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
      reservationRepository: mockReservationRepository,
      room: mockDemoRooms[0],
      roomLockGateway: mockRoomLockGateway,
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
