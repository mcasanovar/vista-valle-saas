import { describe, expect, it, vi } from "vitest";

vi.mock("@/config/server", () => ({ getServerEnvironment: vi.fn() }));
vi.mock("@/infrastructure/database/server", () => ({
  createDatabaseBoundary: vi.fn(),
}));

import { getServerEnvironment } from "@/config/server";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { isBookingAcceptanceEnabled } from "@/features/reservations/confirm-pay-at-property";

describe("isBookingAcceptanceEnabled", () => {
  it("is always enabled outside production, regardless of BOOKING_ENABLED", () => {
    vi.mocked(createDatabaseBoundary).mockReturnValue({
      context: "mock",
    } as ReturnType<typeof createDatabaseBoundary>);
    vi.mocked(getServerEnvironment).mockReturnValue({
      BOOKING_ENABLED: false,
    } as ReturnType<typeof getServerEnvironment>);

    expect(isBookingAcceptanceEnabled()).toBe(true);
  });

  it("respects BOOKING_ENABLED only under production", () => {
    vi.mocked(createDatabaseBoundary).mockReturnValue({
      context: "production",
      connectionString: "postgresql://example",
    } as ReturnType<typeof createDatabaseBoundary>);

    vi.mocked(getServerEnvironment).mockReturnValue({
      BOOKING_ENABLED: false,
    } as ReturnType<typeof getServerEnvironment>);
    expect(isBookingAcceptanceEnabled()).toBe(false);

    vi.mocked(getServerEnvironment).mockReturnValue({
      BOOKING_ENABLED: true,
    } as ReturnType<typeof getServerEnvironment>);
    expect(isBookingAcceptanceEnabled()).toBe(true);
  });
});
