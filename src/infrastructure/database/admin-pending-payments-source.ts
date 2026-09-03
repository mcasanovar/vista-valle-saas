import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { ReservationOrigin, ReservationStatus } from "@/features/reservations";
import {
  guests,
  payments,
  reservationItems,
  reservations,
} from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

/** Same shape `listMockReservationPaymentAdminViews` (`confirm-pay-at-property.ts`) already produces, so `operational-alerts.ts` reads either without branching on shape. */
export type PendingPayAtPropertyPayment = Readonly<{
  id: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  /** First room line, mirroring the "legacy single-room" field on `ReservationRecord`. */
  roomId: string;
  roomIds: readonly string[];
  origin: ReservationOrigin;
  status: ReservationStatus;
  totalClp: number;
  paymentStatus: "pending";
}>;

/**
 * Reservations paying "on arrival" whose payment is still pending
 * (`reservations.paymentMode = "pay_at_property"`, `payments.status =
 * "pending"`). `payments` is 1:1 with a pay-at-property reservation (see
 * `reservation-repository.ts`), so this join never duplicates a
 * reservation - room lines are fetched separately to avoid a
 * one-row-per-room join producing one alert per room.
 */
export async function queryPendingPayAtPropertyPayments(
  db: ProductionDatabase
): Promise<readonly PendingPayAtPropertyPayment[]> {
  const rows = await db
    .select({
      checkIn: reservations.checkIn,
      checkOut: reservations.checkOut,
      firstName: guests.firstName,
      id: reservations.id,
      lastName: guests.lastName,
      origin: reservations.origin,
      status: reservations.status,
      totalClp: reservations.totalClp,
    })
    .from(reservations)
    .innerJoin(payments, eq(payments.reservationId, reservations.id))
    .innerJoin(guests, eq(reservations.guestId, guests.id))
    .where(
      and(
        eq(reservations.paymentMode, "pay_at_property"),
        eq(payments.status, "pending")
      )
    );

  if (rows.length === 0) return [];

  const itemRows = await db
    .select({
      reservationId: reservationItems.reservationId,
      roomId: reservationItems.roomId,
    })
    .from(reservationItems)
    .where(
      inArray(
        reservationItems.reservationId,
        rows.map((row) => row.id)
      )
    );

  const roomIdsByReservation = new Map<string, string[]>();
  for (const item of itemRows) {
    const roomIds = roomIdsByReservation.get(item.reservationId) ?? [];
    roomIds.push(item.roomId);
    roomIdsByReservation.set(item.reservationId, roomIds);
  }

  return Object.freeze(
    rows.map((row) => {
      const roomIds = roomIdsByReservation.get(row.id) ?? [];
      return Object.freeze({
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        guestName: `${row.firstName} ${row.lastName}`,
        id: row.id,
        origin: row.origin as ReservationOrigin,
        paymentStatus: "pending" as const,
        roomId: roomIds[0] ?? "",
        roomIds: Object.freeze(roomIds),
        status: row.status as ReservationStatus,
        totalClp: row.totalClp,
      });
    })
  );
}
