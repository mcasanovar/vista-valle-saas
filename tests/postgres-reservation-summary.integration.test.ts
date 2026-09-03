import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { getReservationSummaryById } from "@/infrastructure/database/reservation-summary-source";
import * as schema from "@/persistence/schema";
import { guests, reservations, rooms } from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL reservation summary integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL reservation summary integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql!, { schema });
    const roomId = "00000000-0000-4000-8000-000000000801";
    const guestId = "00000000-0000-4000-8000-000000000802";

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    it("returns guest name, origin, and total for a reservation, and null when it doesn't exist", async () => {
      await db.insert(rooms).values({
        active: false,
        baseNightlyPriceClp: 60_000,
        capacity: 2,
        id: roomId,
        name: "Habitación Resumen",
      });
      await db.insert(guests).values({
        email: "reservation-summary-integration@example.test",
        firstName: "Carlos",
        id: guestId,
        lastName: "Soto",
        phone: "+56 9 5555 5555",
      });
      const [reservation] = await db
        .insert(reservations)
        .values({
          checkIn: "2034-01-01",
          checkOut: "2034-01-03",
          guestId,
          origin: "airbnb",
          paymentMode: "pay_at_property",
          publicId: "VV-summary",
          status: "confirmed",
          totalClp: 150_000,
        })
        .returning();

      const summary = await getReservationSummaryById(db, reservation!.id);
      expect(summary).toEqual({
        guestName: "Carlos Soto",
        origin: "airbnb",
        totalClp: 150_000,
      });

      const missing = await getReservationSummaryById(
        db,
        "00000000-0000-4000-8000-000000000899"
      );
      expect(missing).toBeNull();
    });
  });
}
