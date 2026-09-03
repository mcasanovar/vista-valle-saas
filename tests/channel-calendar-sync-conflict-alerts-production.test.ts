import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordOperationalAlert: vi.fn(),
  listOperationalAlerts: vi.fn(),
}));

vi.mock("@/infrastructure/database/server", () => ({
  createDatabaseBoundary: () => ({
    context: "production",
    connectionString: "postgres://test",
  }),
}));
vi.mock("@/infrastructure/database/client", () => ({
  createProductionDatabase: () => ({}),
}));
vi.mock("@/infrastructure/database/operational-alerts-source", () => ({
  recordOperationalAlert: mocks.recordOperationalAlert,
  listOperationalAlerts: mocks.listOperationalAlerts,
}));

import {
  CHANNEL_SYNC_CONFLICT_MESSAGE,
  listChannelSyncConflictAlerts,
  recordChannelSyncConflictAlert,
} from "@/features/channel-calendar-sync/conflict-alerts";

describe("channel-sync conflict alerts under production context", () => {
  it("persists through the operational_alerts adapter and returns the same shape mock does", async () => {
    mocks.recordOperationalAlert.mockResolvedValue({
      id: "alert-1",
      kind: "channel_sync_conflict",
      roomId: "room-1",
      reservationId: "reservation-1",
      message: CHANNEL_SYNC_CONFLICT_MESSAGE,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    const alert = await recordChannelSyncConflictAlert({
      roomId: "room-1",
      existingReservationId: "reservation-1",
    });

    expect(mocks.recordOperationalAlert).toHaveBeenCalledWith(
      {},
      {
        kind: "channel_sync_conflict",
        message: CHANNEL_SYNC_CONFLICT_MESSAGE,
        reservationId: "reservation-1",
        roomId: "room-1",
      }
    );
    expect(alert).toEqual({
      id: "alert-1",
      roomId: "room-1",
      existingReservationId: "reservation-1",
      message: CHANNEL_SYNC_CONFLICT_MESSAGE,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
  });

  it("lists only channel_sync_conflict rows, in the same shape mock does", async () => {
    mocks.listOperationalAlerts.mockResolvedValue([
      {
        id: "alert-1",
        kind: "channel_sync_conflict",
        roomId: "room-1",
        reservationId: null,
        message: CHANNEL_SYNC_CONFLICT_MESSAGE,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);

    const alerts = await listChannelSyncConflictAlerts();

    expect(alerts).toEqual([
      {
        id: "alert-1",
        roomId: "room-1",
        existingReservationId: undefined,
        message: CHANNEL_SYNC_CONFLICT_MESSAGE,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
  });
});
