import "server-only";

import type {
  GuestContactDetails,
  GuestRecord,
  GuestRepository,
} from "@/features/reservations";
import { guests } from "@/persistence/schema";
import type { ProductionRoomLockTransaction } from "./room-lock";

/**
 * Drizzle/PostgreSQL-backed `GuestRepository` (design.md decision 5).
 * `createGuest` inserts into `guests` using the same
 * `ProductionRoomLockTransaction` the caller received from
 * `createDrizzleRoomLockGateway` (`./room-lock.ts`), so guest creation
 * commits or rolls back atomically with the room lock and whatever hold
 * or reservation insert runs alongside it (see
 * `src/infrastructure/database/hold-repository.ts` and
 * `src/features/reservations/create-hold.ts`).
 *
 * This module type-checks against the schema but is only exercised
 * against a live PostgreSQL server in an explicit `production`/
 * integration environment; it must never be imported by a code path that
 * runs under `VISTA_VALLE_CONFIG_CONTEXT=mock` (see
 * `src/infrastructure/database/server.ts` and design.md decision 13).
 */
export function createDrizzleGuestRepository(): GuestRepository<ProductionRoomLockTransaction> {
  return Object.freeze({
    createGuest: async (
      tx: ProductionRoomLockTransaction,
      guest: GuestContactDetails
    ): Promise<GuestRecord> => {
      const [row] = await tx
        .insert(guests)
        .values({
          company: guest.company,
          email: guest.email,
          firstName: guest.firstName,
          lastName: guest.lastName,
          phone: guest.phone,
          rut: guest.rut,
        })
        .returning({
          company: guests.company,
          email: guests.email,
          firstName: guests.firstName,
          id: guests.id,
          lastName: guests.lastName,
          phone: guests.phone,
          rut: guests.rut,
        });

      if (!row) {
        throw new Error("Failed to insert guest: no row returned");
      }

      return Object.freeze({
        company: row.company ?? undefined,
        email: row.email,
        firstName: row.firstName,
        id: row.id,
        lastName: row.lastName,
        phone: row.phone,
        rut: row.rut ?? undefined,
      });
    },
  });
}
