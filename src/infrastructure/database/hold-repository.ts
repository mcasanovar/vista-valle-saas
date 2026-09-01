import "server-only";

import { eq } from "drizzle-orm";

import type {
  CreateHoldInput,
  HoldRepository,
  ReservationHoldRecord,
} from "@/features/reservations";
import { payments, reservationHolds } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";
import type { ProductionRoomLockTransaction } from "./room-lock";

const holdColumns = {
  chargesClp: reservationHolds.chargesClp,
  checkIn: reservationHolds.checkIn,
  checkOut: reservationHolds.checkOut,
  createdAt: reservationHolds.createdAt,
  expiresAt: reservationHolds.expiresAt,
  guestCount: reservationHolds.guestCount,
  guestId: reservationHolds.guestId,
  id: reservationHolds.id,
  nightlyPriceClp: reservationHolds.nightlyPriceClp,
  roomId: reservationHolds.roomId,
  totalClp: reservationHolds.totalClp,
} as const;

/**
 * Drizzle/PostgreSQL-backed `HoldRepository` (design.md decisions 5 and
 * 7). `createHold` inserts into `reservation_holds` using the same
 * `ProductionRoomLockTransaction` `createDrizzleRoomLockGateway`
 * (`./room-lock.ts`) opened, so the hold, its guest
 * (`./guest-repository.ts`), and the room lock's overlap recheck commit
 * or roll back together (design.md decision 6). `getHoldById` is a plain,
 * non-transactional read against `db` for later use (e.g. Checkout Pro
 * preference creation), matching the mock's read semantics.
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
      const [row] = await tx
        .insert(reservationHolds)
        .values({
          chargesClp: input.pricing.chargesClp,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          expiresAt: input.expiresAt,
          guestCount: input.guestCount,
          guestId: input.guestId,
          nightlyPriceClp: input.pricing.nightlyPriceClp,
          roomId: input.roomId,
          totalClp: input.pricing.totalClp,
        })
        .returning(holdColumns);

      if (!row) {
        throw new Error("Failed to insert reservation hold: no row returned");
      }

      return Object.freeze(row);
    },
    getHoldById: async (id: string): Promise<ReservationHoldRecord | null> => {
      const [row] = await db
        .select(holdColumns)
        .from(reservationHolds)
        .where(eq(reservationHolds.id, id));

      return row ? Object.freeze(row) : null;
    },
    deleteHold: async (
      tx: ProductionRoomLockTransaction,
      hold: ReservationHoldRecord
    ): Promise<void> => {
      // Fintoc payments reference their originating hold (`payments.hold_id`,
      // `onDelete: "restrict"`) until they either get confirmed onto a
      // reservation or fail; clear that reference first so this delete
      // never hits `payments_hold_id_reservation_holds_id_fk` regardless of
      // which caller (confirmed or failed payment) is releasing the hold.
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
