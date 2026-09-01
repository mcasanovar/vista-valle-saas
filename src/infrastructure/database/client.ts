import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/persistence/schema";
import type { ProductionDatabaseBoundary } from "@/infrastructure/supabase/contracts";

/**
 * The production, Drizzle-backed database handle used by server-only
 * adapters (see `./room-lock.ts`). This type is only ever constructed from
 * a `ProductionDatabaseBoundary`, which `createDatabaseBoundary()`
 * (`./server.ts`) only returns once `getServerEnvironment()` has validated
 * `DATABASE_URL` as a non-mock, non-placeholder value under
 * `VISTA_VALLE_CONFIG_CONTEXT=production` (see `src/config/server.ts`).
 *
 * Nothing in the mock context calls this factory, and importing this
 * module never opens a connection: the `postgres-js` client only connects
 * lazily when a query actually runs.
 */
export type ProductionDatabase = PostgresJsDatabase<typeof schema>;

/**
 * The open transaction handed to a locked room's `operation` by
 * `createDrizzleRoomLockGateway` (`./room-lock.ts`). Derived from
 * `ProductionDatabase["transaction"]` itself, rather than re-declared by
 * hand, so it always matches whatever `drizzle(...)` actually requires.
 */
export type ProductionDatabaseTransaction = Parameters<
  Parameters<ProductionDatabase["transaction"]>[0]
>[0];

export function createProductionDatabase(
  boundary: ProductionDatabaseBoundary
): ProductionDatabase {
  const client = postgres(boundary.connectionString);
  return drizzle(client, { schema });
}
