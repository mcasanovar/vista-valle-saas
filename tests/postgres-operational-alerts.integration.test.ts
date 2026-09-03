import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  listOperationalAlerts,
  recordOperationalAlert,
} from "@/infrastructure/database/operational-alerts-source";
import * as schema from "@/persistence/schema";
import { guests, reservations, rooms } from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL operational alerts integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL operational alerts integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql!, { schema });
    const roomId = "00000000-0000-4000-8000-000000000601";
    const guestId = "00000000-0000-4000-8000-000000000602";

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    it("inserts an alert and lists it back ordered by createdAt descending", async () => {
      await db.insert(rooms).values({
        active: false,
        baseNightlyPriceClp: 60_000,
        capacity: 2,
        id: roomId,
        name: "Habitación Alertas",
      });

      const older = await recordOperationalAlert(db, {
        kind: "channel_sync_conflict",
        message: "Conflicto más antiguo",
        roomId,
      });
      const newer = await recordOperationalAlert(db, {
        kind: "channel_sync_conflict",
        message: "Conflicto más reciente",
        roomId,
      });

      const alerts = await listOperationalAlerts(db);
      const ids = alerts.map((alert) => alert.id);

      expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
      expect(alerts.find((alert) => alert.id === newer.id)).toMatchObject({
        kind: "channel_sync_conflict",
        message: "Conflicto más reciente",
        roomId,
      });
    });

    it("survives a fresh adapter instance, unlike the in-memory mock store", async () => {
      await db.insert(guests).values({
        email: "operational-alerts-integration@example.test",
        firstName: "Op",
        id: guestId,
        lastName: "Alerts",
        phone: "+56 9 3333 3333",
      });
      const [reservation] = await db
        .insert(reservations)
        .values({
          checkIn: "2032-01-01",
          checkOut: "2032-01-03",
          guestId,
          origin: "airbnb",
          paymentMode: "pay_at_property",
          publicId: "VV-alerts-integration",
          status: "confirmed",
          totalClp: 120_000,
        })
        .returning();

      const written = await recordOperationalAlert(db, {
        kind: "channel_sync_conflict",
        message: "Reserva sobreduplicada",
        reservationId: reservation!.id,
        roomId,
      });

      // A second connection/adapter instance, as a fresh process would open
      // after a restart - proves this no longer lives in `globalThis`.
      const restartedSql = postgres(integrationUrl!, { max: 1 });
      const restartedDb = drizzle(restartedSql, { schema });
      try {
        const alerts = await listOperationalAlerts(restartedDb);
        expect(alerts.find((alert) => alert.id === written.id)).toMatchObject(
          {
            message: "Reserva sobreduplicada",
            reservationId: reservation!.id,
            roomId,
          }
        );
      } finally {
        await restartedSql.end({ timeout: 5 });
      }
    });
  });
}
