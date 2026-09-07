import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { getAdminDashboardMonthlySummary } from "@/infrastructure/database/admin-dashboard-summary-source";
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
  describe.skip("PostgreSQL admin dashboard monthly summary integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL admin dashboard monthly summary integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql!, { schema });
    const roomActiveId = "00000000-0000-4000-8000-000000000801";
    const roomUnpaidId = "00000000-0000-4000-8000-000000000802";
    const roomInactiveId = "00000000-0000-4000-8000-000000000803";
    const guestId = "00000000-0000-4000-8000-000000000804";
    const range = { from: "2033-02-01", to: "2033-02-28" };

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    it("aggregates revenue, reservation counts, channels, room occupancy and daily sales for the given month", async () => {
      await db.insert(rooms).values([
        {
          active: true,
          baseNightlyPriceClp: 60_000,
          capacity: 2,
          id: roomActiveId,
          name: "Habitación Activa",
        },
        {
          active: true,
          baseNightlyPriceClp: 50_000,
          capacity: 2,
          id: roomUnpaidId,
          name: "Habitación Sin Pago",
        },
        {
          active: false,
          baseNightlyPriceClp: 40_000,
          capacity: 2,
          id: roomInactiveId,
          name: "Habitación Inactiva",
        },
      ]);
      await db.insert(guests).values({
        email: "dashboard-summary-integration@example.test",
        firstName: "Resu",
        id: guestId,
        lastName: "Men",
        phone: "+56 9 5555 5555",
      });

      const [confirmedPaid] = await db
        .insert(reservations)
        .values({
          checkIn: "2033-02-05",
          checkOut: "2033-02-08",
          guestId,
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: "VV-summary-confirmed-paid",
          status: "confirmed",
          totalClp: 180_000,
        })
        .returning();
      await db.insert(reservationItems).values({
        chargesClp: 0,
        nightlyPriceClp: 60_000,
        nights: 3,
        reservationId: confirmedPaid!.id,
        roomId: roomActiveId,
        subtotalClp: 180_000,
      });
      await db.insert(payments).values({
        amountClp: 180_000,
        externalReference: "summary-confirmed-paid-ref",
        mode: "pay_at_property",
        provider: "pay_at_property",
        receivedAt: new Date(),
        reservationId: confirmedPaid!.id,
        status: "approved",
      });

      const [confirmedUnpaid] = await db
        .insert(reservations)
        .values({
          checkIn: "2033-02-10",
          checkOut: "2033-02-12",
          guestId,
          origin: "airbnb",
          paymentMode: "pay_at_property",
          publicId: "VV-summary-confirmed-unpaid",
          status: "confirmed",
          totalClp: 100_000,
        })
        .returning();
      await db.insert(reservationItems).values({
        chargesClp: 0,
        nightlyPriceClp: 50_000,
        nights: 2,
        reservationId: confirmedUnpaid!.id,
        roomId: roomUnpaidId,
        subtotalClp: 100_000,
      });
      await db.insert(payments).values({
        amountClp: 100_000,
        externalReference: "summary-confirmed-unpaid-ref",
        mode: "pay_at_property",
        provider: "pay_at_property",
        reservationId: confirmedUnpaid!.id,
        status: "pending",
      });

      const [cancelled] = await db
        .insert(reservations)
        .values({
          checkIn: "2033-02-15",
          checkOut: "2033-02-16",
          guestId,
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: "VV-summary-cancelled",
          status: "cancelled",
          totalClp: 50_000,
        })
        .returning();
      await db.insert(reservationItems).values({
        chargesClp: 0,
        nightlyPriceClp: 50_000,
        nights: 1,
        reservationId: cancelled!.id,
        roomId: roomActiveId,
        subtotalClp: 50_000,
      });

      const [noShow] = await db
        .insert(reservations)
        .values({
          checkIn: "2033-02-20",
          checkOut: "2033-02-21",
          guestId,
          origin: "booking",
          paymentMode: "pay_at_property",
          publicId: "VV-summary-no-show",
          status: "no_show",
          totalClp: 30_000,
        })
        .returning();
      await db.insert(reservationItems).values({
        chargesClp: 0,
        nightlyPriceClp: 30_000,
        nights: 1,
        reservationId: noShow!.id,
        roomId: roomActiveId,
        subtotalClp: 30_000,
      });

      const summary = await getAdminDashboardMonthlySummary(db, range);

      expect(summary.approvedRevenueClp).toBe(180_000);
      expect(summary.validReservationCount).toBe(2);
      expect(summary.cancelledReservationCount).toBe(1);
      expect(summary.noShowReservationCount).toBe(1);

      const website = summary.channelBreakdown.find(
        (channel) => channel.origin === "website"
      );
      expect(website).toMatchObject({
        approvedAmountClp: 180_000,
        reservationCount: 1,
      });
      const whatsapp = summary.channelBreakdown.find(
        (channel) => channel.origin === "whatsapp"
      );
      expect(whatsapp).toMatchObject({
        approvedAmountClp: 0,
        reservationCount: 0,
      });

      const activeRoom = summary.roomOccupancy.find(
        (room) => room.roomId === roomActiveId
      );
      expect(activeRoom).toMatchObject({ availableNights: 28, occupiedNights: 3 });

      const unpaidRoom = summary.roomOccupancy.find(
        (room) => room.roomId === roomUnpaidId
      );
      expect(unpaidRoom).toMatchObject({ availableNights: 28, occupiedNights: 0 });

      expect(
        summary.roomOccupancy.some((room) => room.roomId === roomInactiveId)
      ).toBe(false);

      expect(summary.dailySales).toHaveLength(28);
      expect(
        summary.dailySales.find((day) => day.day === "2033-02-05")
      ).toMatchObject({ amountClp: 180_000 });
      expect(
        summary.dailySales.find((day) => day.day === "2033-02-01")
      ).toMatchObject({ amountClp: 0 });
    });

    it("attributes revenue to the check-in month even when the reservation was created and paid earlier", async () => {
      const [advanceBooking] = await db
        .insert(reservations)
        .values({
          checkIn: "2033-02-25",
          checkOut: "2033-02-27",
          guestId,
          origin: "website",
          paymentMode: "pay_now",
          publicId: "VV-summary-advance-booking",
          status: "confirmed",
          totalClp: 90_000,
        })
        .returning();
      await db.insert(reservationItems).values({
        chargesClp: 0,
        nightlyPriceClp: 45_000,
        nights: 2,
        reservationId: advanceBooking!.id,
        roomId: roomActiveId,
        subtotalClp: 90_000,
      });
      // Paid the same day the reservation was created (January), not the
      // February check-in month it belongs to.
      await db.insert(payments).values({
        amountClp: 90_000,
        externalReference: "summary-advance-booking-ref",
        mode: "pay_now",
        provider: "fintoc",
        receivedAt: new Date("2033-01-13T15:00:00.000Z"),
        reservationId: advanceBooking!.id,
        status: "approved",
      });

      const summary = await getAdminDashboardMonthlySummary(db, range);

      expect(summary.approvedRevenueClp).toBe(180_000 + 90_000);
      expect(
        summary.dailySales.find((day) => day.day === "2033-02-25")
      ).toMatchObject({ amountClp: 90_000 });
    });
  });
}
