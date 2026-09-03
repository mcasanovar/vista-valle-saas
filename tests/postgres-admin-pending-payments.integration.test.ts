import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { queryPendingPayAtPropertyPayments } from "@/infrastructure/database/admin-pending-payments-source";
import * as schema from "@/persistence/schema";
import {
  guests,
  payments,
  reservationItems,
  reservations,
  rooms,
} from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL admin pending payments integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL admin pending payments integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql!, { schema });
    const roomId = "00000000-0000-4000-8000-000000000701";
    const guestId = "00000000-0000-4000-8000-000000000702";

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    it("returns only pay-at-property reservations with a pending payment", async () => {
      await db.insert(rooms).values({
        active: false,
        baseNightlyPriceClp: 60_000,
        capacity: 2,
        id: roomId,
        name: "Habitación Pagos Pendientes",
      });
      await db.insert(guests).values({
        email: "pending-payments-integration@example.test",
        firstName: "Pen",
        id: guestId,
        lastName: "Diente",
        phone: "+56 9 4444 4444",
      });

      const [pending] = await db
        .insert(reservations)
        .values({
          checkIn: "2033-01-01",
          checkOut: "2033-01-03",
          guestId,
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: "VV-pending-payment",
          status: "confirmed",
          totalClp: 120_000,
        })
        .returning();
      await db.insert(reservationItems).values({
        chargesClp: 0,
        nightlyPriceClp: 60_000,
        nights: 2,
        reservationId: pending!.id,
        roomId,
        subtotalClp: 120_000,
      });
      await db.insert(payments).values({
        amountClp: 120_000,
        externalReference: "pending-payment-ref",
        mode: "pay_at_property",
        provider: "pay_at_property",
        reservationId: pending!.id,
        status: "pending",
      });

      const [approved] = await db
        .insert(reservations)
        .values({
          checkIn: "2033-01-05",
          checkOut: "2033-01-06",
          guestId,
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: "VV-approved-payment",
          status: "confirmed",
          totalClp: 60_000,
        })
        .returning();
      await db.insert(reservationItems).values({
        chargesClp: 0,
        nightlyPriceClp: 60_000,
        nights: 1,
        reservationId: approved!.id,
        roomId,
        subtotalClp: 60_000,
      });
      await db.insert(payments).values({
        amountClp: 60_000,
        externalReference: "approved-payment-ref",
        mode: "pay_at_property",
        provider: "pay_at_property",
        receivedAt: new Date(),
        reservationId: approved!.id,
        status: "approved",
      });

      const result = await queryPendingPayAtPropertyPayments(db);
      const ids = result.map((row) => row.id);

      expect(ids).toContain(pending!.id);
      expect(ids).not.toContain(approved!.id);
      expect(result.find((row) => row.id === pending!.id)).toMatchObject({
        checkIn: "2033-01-01",
        checkOut: "2033-01-03",
        guestName: "Pen Diente",
        paymentStatus: "pending",
        roomId,
        totalClp: 120_000,
      });
    });
  });
}
