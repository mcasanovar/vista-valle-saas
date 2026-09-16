import "server-only";

import { eq } from "drizzle-orm";

import type {
  CreateHoldInput,
  HoldRepository,
  ReservationHoldItemRecord,
  ReservationHoldRecord,
} from "@/features/reservations";
import {
  payments,
  reservationHoldItems,
  reservationHolds,
} from "@/persistence/schema";
import type { ProductionDatabase } from "./client";
import type { ProductionRoomLockTransaction } from "./room-lock";

const holdColumns = {
  checkIn: reservationHolds.checkIn,
  checkOut: reservationHolds.checkOut,
  createdAt: reservationHolds.createdAt,
  expiresAt: reservationHolds.expiresAt,
  guestId: reservationHolds.guestId,
  id: reservationHolds.id,
  totalClp: reservationHolds.totalClp,
} as const;

const holdItemColumns = {
  chargesClp: reservationHoldItems.chargesClp,
  guestCount: reservationHoldItems.guestCount,
  holdId: reservationHoldItems.holdId,
  nightlyPriceClp: reservationHoldItems.nightlyPriceClp,
  nights: reservationHoldItems.nights,
  roomId: reservationHoldItems.roomId,
  subtotalClp: reservationHoldItems.subtotalClp,
} as const;

async function getHoldItems(
  db: Pick<ProductionDatabase, "select">,
  holdId: string
): Promise<readonly ReservationHoldItemRecord[]> {
  const rows = await db
    .select(holdItemColumns)
    .from(reservationHoldItems)
    .where(eq(reservationHoldItems.holdId, holdId));
  return Object.freeze(
    rows.map((row) =>
      Object.freeze({
        chargesClp: row.chargesClp,
        guestCount: row.guestCount,
        nightlyPriceClp: row.nightlyPriceClp,
        nights: row.nights,
        roomId: row.roomId,
        subtotalClp: row.subtotalClp,
      })
    )
  );
}

/**
 * Drizzle/PostgreSQL-backed `HoldRepository` (design.md decisions 5 and
 * 7 of `build-vista-valle-booking-mvp`; multi-room support per
 * `add-mercado-pago-checkout-pro` design.md decision 1). `createHold`
 * inserts into `reservation_holds` and one `reservation_hold_items` row
 * per room, using the same `ProductionRoomLockTransaction`
 * `createDrizzleRoomLockGateway` (`./room-lock.ts`) opened, so the hold,
 * its items, its guest (`./guest-repository.ts`), and the room lock's
 * overlap recheck commit or roll back together. `getHoldById` is a
 * plain, non-transactional read against `db` for later use (e.g.
 * Checkout Pro preference creation), matching the mock's read
 * semantics.
 *
 * This module type-checks against the schema but is only exercised
 * against a live PostgreSQL server in an explicit `production`/
 * integration environment; it must never be imported by a code path that
 * runs under `VISTA_VALLE_CONFIG_CONTEXT=mock` (see
 * `src/infrastructure/database/server.ts` and design.md decision 13).
 */
export function createDrizzleHoldRepository(
  db: ProductionDatabase
): HoldRepository<ProductionRoomLockTransaction> {
  return Object.freeze({
    createHold: async (
      tx: ProductionRoomLockTransaction,
      input: CreateHoldInput
    ): Promise<ReservationHoldRecord> => {
      if (input.items.length === 0) {
        throw new Error("Hold requires at least one room item");
      }

      const [row] = await tx
        .insert(reservationHolds)
        .values({
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          expiresAt: input.expiresAt,
          guestId: input.guestId,
          totalClp: input.totalClp,
        })
        .returning(holdColumns);

      if (!row) {
        throw new Error("Failed to insert reservation hold: no row returned");
      }

      const itemRows = await tx
        .insert(reservationHoldItems)
        .values(
          input.items.map((item) => ({
            chargesClp: item.chargesClp,
            guestCount: item.guestCount,
            holdId: row.id,
            nightlyPriceClp: item.nightlyPriceClp,
            nights: item.nights,
            roomId: item.roomId,
            subtotalClp: item.totalClp,
          }))
        )
        .returning(holdItemColumns);

      return Object.freeze({
        ...row,
        items: Object.freeze(
          itemRows.map((itemRow) => Object.freeze(itemRow))
        ),
      });
    },
    getHoldById: async (id: string): Promise<ReservationHoldRecord | null> => {
      const [row] = await db
        .select(holdColumns)
        .from(reservationHolds)
        .where(eq(reservationHolds.id, id));

      if (!row) return null;

      const items = await getHoldItems(db, id);
      return Object.freeze({ ...row, items });
    },
    deleteHold: async (
      tx: ProductionRoomLockTransaction,
      hold: ReservationHoldRecord
    ): Promise<void> => {
      // Payments reference their originating hold (`payments.hold_id`,
      // `onDelete: "restrict"`) until they either get confirmed onto a
      // reservation or fail; clear that reference first so this delete
      // never hits `payments_hold_id_reservation_holds_id_fk` regardless of
      // which caller (confirmed or failed payment) is releasing the hold.
      // `reservation_hold_items` cascades automatically.
      await tx
        .update(payments)
        .set({ holdId: null })
        .where(eq(payments.holdId, hold.id));
      await tx
        .delete(reservationHolds)
        .where(eq(reservationHolds.id, hold.id));
    },
  });
}
