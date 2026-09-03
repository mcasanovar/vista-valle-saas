import "server-only";

import { eq } from "drizzle-orm";

import type { ReservationOrigin } from "@/features/reservations";
import { guests, reservations } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

export type ReservationSummary = Readonly<{
  guestName: string;
  origin: ReservationOrigin;
  totalClp: number;
}>;

/**
 * Guest name/total/origin for a single reservation, so a channel-sync
 * conflict alert (`operational-alerts.ts`) can show who/how much/which
 * channel without the admin opening the reservation. One conflict alert at
 * a time is expected to need this - unlike `admin-pending-payments-source.ts`,
 * which batches because it lists every pending payment at once.
 */
export async function getReservationSummaryById(
  db: ProductionDatabase,
  reservationId: string
): Promise<ReservationSummary | null> {
  const [row] = await db
    .select({
      firstName: guests.firstName,
      lastName: guests.lastName,
      origin: reservations.origin,
      totalClp: reservations.totalClp,
    })
    .from(reservations)
    .innerJoin(guests, eq(reservations.guestId, guests.id))
    .where(eq(reservations.id, reservationId))
    .limit(1);
  if (!row) return null;
  return Object.freeze({
    guestName: `${row.firstName} ${row.lastName}`,
    origin: row.origin as ReservationOrigin,
    totalClp: row.totalClp,
  });
}
