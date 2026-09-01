import "server-only";

import { eq } from "drizzle-orm";
import { nights } from "@/features/availability";
import { guests, reservationItems, reservations, rooms } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

/**
 * Read-only, Drizzle/PostgreSQL-backed composition for the public booking
 * confirmation page (`/reserva/[publicId]`), mirroring the shape
 * `getPublicBookingConfirmation` already builds from mock data
 * (`@/features/reservations/confirm-pay-at-property`). Returns `null` for
 * an unknown `publicId` rather than throwing, matching the mock behavior.
 */
export async function getProductionPublicBookingConfirmation(
  db: ProductionDatabase,
  publicId: string
) {
  const [reservation] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.publicId, publicId));
  if (!reservation) return null;

  const [guest] = await db
    .select({ firstName: guests.firstName })
    .from(guests)
    .where(eq(guests.id, reservation.guestId));
  if (!guest) return null;

  const items = await db
    .select({ name: rooms.name })
    .from(reservationItems)
    .innerJoin(rooms, eq(reservationItems.roomId, rooms.id))
    .where(eq(reservationItems.reservationId, reservation.id));
  if (items.length === 0) return null;

  return Object.freeze({
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    guest: Object.freeze({ firstName: guest.firstName }),
    guestCount: 1,
    nights: nights(reservation.checkIn, reservation.checkOut),
    paymentMode:
      reservation.paymentMode === "pay_now"
        ? ("PAY_NOW" as const)
        : ("PAY_AT_PROPERTY" as const),
    publicId: reservation.publicId,
    room: Object.freeze({ name: items[0]!.name ?? "" }),
    rooms: Object.freeze(
      items.map((item) => Object.freeze({ name: item.name ?? "" }))
    ),
    totalClp: reservation.totalClp,
  });
}
