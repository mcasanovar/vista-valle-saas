import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { getProductionPublicBookingConfirmation } from "@/infrastructure/database/booking-confirmation-source";
import * as schema from "@/persistence/schema";
import { guests, reservationItems, reservations, rooms } from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL booking confirmation integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL booking confirmation integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql!, { schema });
    const roomAId = "00000000-0000-4000-8000-000000000901";
    const roomBId = "00000000-0000-4000-8000-000000000902";
    const guestId = "00000000-0000-4000-8000-000000000903";

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    it("reports the full party size across every reservation item, not just the first", async () => {
      await db.insert(rooms).values([
        {
          active: false,
          baseNightlyPriceClp: 60_000,
          capacity: 2,
          id: roomAId,
          name: "Habitación Confirmación A",
        },
        {
          active: false,
          baseNightlyPriceClp: 40_000,
          capacity: 2,
          id: roomBId,
          name: "Habitación Confirmación B",
        },
      ]);
      await db.insert(guests).values({
        email: "booking-confirmation-integration@example.test",
        firstName: "Valentina",
        id: guestId,
        lastName: "Rojas",
        phone: "+56 9 4444 4444",
      });
      const [reservation] = await db
        .insert(reservations)
        .values({
          checkIn: "2034-02-01",
          checkOut: "2034-02-03",
          guestId,
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: "VV-confirmation-three-guests",
          status: "confirmed",
          totalClp: 200_000,
        })
        .returning();
      await db.insert(reservationItems).values([
        {
          guestCount: 2,
          nightlyPriceClp: 60_000,
          nights: 2,
          reservationId: reservation!.id,
          roomId: roomAId,
          subtotalClp: 120_000,
        },
        {
          guestCount: 1,
          nightlyPriceClp: 40_000,
          nights: 2,
          reservationId: reservation!.id,
          roomId: roomBId,
          subtotalClp: 80_000,
        },
      ]);

      const confirmation = await getProductionPublicBookingConfirmation(
        db,
        "VV-confirmation-three-guests"
      );

      expect(confirmation?.guestCount).toBe(3);
    });

    it("returns null for an unknown publicId", async () => {
      const confirmation = await getProductionPublicBookingConfirmation(
        db,
        "VV-does-not-exist"
      );

      expect(confirmation).toBeNull();
    });
  });
}
