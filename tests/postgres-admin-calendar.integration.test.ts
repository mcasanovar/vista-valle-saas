import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { queryAdminCalendar } from "@/infrastructure/database/admin-calendar-source";
import * as schema from "@/persistence/schema";
import {
  guests,
  reservationHolds,
  reservationItems,
  reservations,
  roomBlocks,
  rooms,
} from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL admin calendar integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL admin calendar integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql!, { schema });
    const roomId = "00000000-0000-4000-8000-000000000101";
    const guestId = "00000000-0000-4000-8000-000000000102";

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    it("returns confirmed reservations, unexpired holds and active blocks, excluding cancelled/expired/removed", async () => {
      await db.insert(rooms).values({
        active: false,
        baseNightlyPriceClp: 60_000,
        capacity: 2,
        id: roomId,
        name: "Habitación Integración",
      });
      await db.insert(guests).values({
        email: "calendar-integration@example.test",
        firstName: "Cal",
        id: guestId,
        lastName: "Endar",
        phone: "+56 9 1111 1111",
      });

      const [confirmed] = await db
        .insert(reservations)
        .values({
          checkIn: "2031-02-01",
          checkOut: "2031-02-03",
          guestId,
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: "VV-calendar-confirmed",
          status: "confirmed",
          totalClp: 120_000,
        })
        .returning();
      await db.insert(reservationItems).values({
        chargesClp: 0,
        nightlyPriceClp: 60_000,
        nights: 2,
        reservationId: confirmed!.id,
        roomId,
        subtotalClp: 120_000,
      });

      const [cancelled] = await db
        .insert(reservations)
        .values({
          checkIn: "2031-02-05",
          checkOut: "2031-02-06",
          guestId,
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: "VV-calendar-cancelled",
          status: "cancelled",
          totalClp: 60_000,
        })
        .returning();
      await db.insert(reservationItems).values({
        chargesClp: 0,
        nightlyPriceClp: 60_000,
        nights: 1,
        reservationId: cancelled!.id,
        roomId,
        subtotalClp: 60_000,
      });

      await db.insert(reservationHolds).values({
        checkIn: "2031-02-10",
        checkOut: "2031-02-11",
        chargesClp: 0,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        guestCount: 1,
        guestId,
        nightlyPriceClp: 60_000,
        roomId,
        totalClp: 60_000,
      });
      await db.insert(reservationHolds).values({
        checkIn: "2031-02-12",
        checkOut: "2031-02-13",
        chargesClp: 0,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
        guestCount: 1,
        guestId,
        nightlyPriceClp: 60_000,
        roomId,
        totalClp: 60_000,
      });

      await db.insert(roomBlocks).values({
        checkIn: "2031-02-15",
        checkOut: "2031-02-17",
        createdByUserId: guestId,
        reason: "Mantención",
        roomId,
      });
      await db.insert(roomBlocks).values({
        checkIn: "2031-02-20",
        checkOut: "2031-02-21",
        createdByUserId: guestId,
        reason: "Removido",
        removedAt: new Date(),
        removedByUserId: guestId,
        roomId,
      });

      const calendar = await queryAdminCalendar(db, {
        checkIn: "2031-02-01",
        checkOut: "2031-03-01",
      });

      const kinds = calendar.items.map((item) => item.kind).sort();
      expect(kinds).toEqual(["block", "hold", "reservation"]);
      expect(
        calendar.items.find((item) => item.kind === "reservation")
      ).toMatchObject({ guestName: "Cal Endar", status: "confirmed" });
      expect(
        calendar.items.find((item) => item.kind === "hold")
      ).toMatchObject({ guestName: "Cal Endar" });
      expect(calendar.items.find((item) => item.kind === "block")).toMatchObject(
        { reason: "Mantención" }
      );
    });
  });
}
