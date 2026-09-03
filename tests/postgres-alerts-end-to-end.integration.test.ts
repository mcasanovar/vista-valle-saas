import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/persistence/schema";
import { guests, reservations, rooms } from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

// Assigned before use whenever `enabled` (below); referenced lazily by the
// `vi.mock` factory, which only runs once something imports the mocked
// module - by then the real integration connection is already assigned.
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

vi.mock("@/infrastructure/database/server", () => ({
  createDatabaseBoundary: () => ({
    context: "production",
    connectionString: integrationUrl,
  }),
}));
vi.mock("@/infrastructure/database/client", () => ({
  createProductionDatabase: () => db,
}));

if (!enabled) {
  describe.skip("PostgreSQL alerts end-to-end integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  const sql = postgres(integrationUrl!, { max: 4 });
  db = drizzle(sql, { schema });

  describe("PostgreSQL alerts end-to-end integration", () => {
    const roomId = "00000000-0000-4000-8000-000000000401";
    const guestId = "00000000-0000-4000-8000-000000000402";

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    it("persists an ingest-time conflict alert in operational_alerts and surfaces it, enriched with the existing reservation's guest/origin/total, from getOperationalAlerts()", async () => {
      const { recordChannelSyncConflictAlert } = await import(
        "@/features/channel-calendar-sync/conflict-alerts"
      );
      const { getOperationalAlerts } = await import(
        "@/features/admin/operational-alerts"
      );

      await db!.insert(rooms).values({
        active: false,
        baseNightlyPriceClp: 60_000,
        capacity: 2,
        id: roomId,
        name: "Habitación Fin a Fin",
      });
      await db!.insert(guests).values({
        email: "alerts-end-to-end-integration@example.test",
        firstName: "Existing",
        id: guestId,
        lastName: "Guest",
        phone: "+56 9 6666 6666",
      });
      const [existing] = await db!
        .insert(reservations)
        .values({
          checkIn: "2035-01-01",
          checkOut: "2035-01-03",
          guestId,
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: "VV-existing-conflict",
          status: "confirmed",
          totalClp: 100_000,
        })
        .returning();

      // Exactly what `ingest.ts` calls when `RoomLockConflictError` is
      // caught for an inbound channel-sync event (spec "Alerta de
      // conflicto en la ingesta"), with the existing reservation it
      // collided with.
      const written = await recordChannelSyncConflictAlert({
        existingReservationId: existing!.id,
        roomId,
      });

      const alerts = await getOperationalAlerts();
      const surfaced = alerts.find((alert) => alert.id === written.id);

      expect(surfaced).toMatchObject({
        guestName: "Existing Guest",
        kind: "channel_sync_conflict",
        origin: "website",
        totalClp: 100_000,
      });
    });
  });
}
