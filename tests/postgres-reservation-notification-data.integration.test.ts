import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { createProductionNotificationTemplateDataSource } from "@/infrastructure/database/notification-template-data-source";
import * as schema from "@/persistence/schema";
import {
  guests,
  reservationItems,
  reservations,
  rooms,
} from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL reservation notification data integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  /**
   * Guards the defect that silently failed 124 confirmation emails: the
   * production template source returned `null` for every reservation, which
   * the delivery worker treats as a permanent error - the intent goes
   * straight to `failed` with no retry.
   */
  describe("PostgreSQL reservation notification data integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql, { schema });
    const source = createProductionNotificationTemplateDataSource(db);
    const roomAId = "00000000-0000-4000-8000-000000000911";
    const roomBId = "00000000-0000-4000-8000-000000000912";
    const guestId = "00000000-0000-4000-8000-000000000913";

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    it("builds the email data of a persisted reservation across all its rooms", async () => {
      await db.insert(rooms).values([
        {
          active: true,
          baseNightlyPriceClp: 60_000,
          capacity: 2,
          id: roomAId,
          name: "Habitación Notificación A",
        },
        {
          // Inactive on purpose: a room deactivated after the booking must
          // still be named in the confirmation email.
          active: false,
          baseNightlyPriceClp: 40_000,
          capacity: 2,
          id: roomBId,
          name: "Habitación Notificación B",
        },
      ]);
      await db.insert(guests).values({
        email: "reservation-notification-integration@example.test",
        firstName: "Camila",
        id: guestId,
        lastName: "Soto",
        phone: "+56 9 5555 5555",
      });
      const [reservation] = await db
        .insert(reservations)
        .values({
          checkIn: "2035-05-01",
          checkOut: "2035-05-03",
          guestId,
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: "VV-notification-data-two-rooms",
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

      const data = await source.getReservationEmailData(reservation!.id);

      expect(data).toMatchObject({
        checkIn: "2035-05-01",
        checkOut: "2035-05-03",
        nights: 2,
        origin: "website",
        publicId: "VV-notification-data-two-rooms",
        roomName: "Habitación Notificación A",
        totalClp: 200_000,
      });
      expect(data?.items).toEqual([
        {
          guestCount: 2,
          roomId: roomAId,
          roomName: "Habitación Notificación A",
          subtotalClp: 120_000,
        },
        {
          guestCount: 1,
          roomId: roomBId,
          roomName: "Habitación Notificación B",
          subtotalClp: 80_000,
        },
      ]);
    });

    it("returns null for an unknown reservation id", async () => {
      await expect(
        source.getReservationEmailData("00000000-0000-4000-8000-000000000914")
      ).resolves.toBeNull();
    });
  });
}
