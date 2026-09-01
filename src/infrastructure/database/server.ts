import "server-only";

import { getServerEnvironment } from "@/config/server";
import type {
  DatabaseBoundary,
  ProductionDatabaseBoundary,
} from "@/infrastructure/supabase/contracts";

const mockDatabaseBoundary: DatabaseBoundary = Object.freeze({
  context: "mock",
});

export function createDatabaseBoundary():
  | DatabaseBoundary
  | ProductionDatabaseBoundary {
  const environment = getServerEnvironment();

  if (environment.VISTA_VALLE_CONFIG_CONTEXT === "mock") {
    return mockDatabaseBoundary;
  }

  return Object.freeze({
    connectionString: environment.DATABASE_URL,
    context: "production",
  });
}
