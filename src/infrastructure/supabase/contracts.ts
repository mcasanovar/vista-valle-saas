import type { SupabaseClient } from "@supabase/supabase-js";

export type InfrastructureContext = "mock" | "production";

export type SessionIdentity = Readonly<{
  email: string | null;
  id: string;
  role: string | null;
}>;

export type ApplicationSession = Readonly<{
  user: SessionIdentity;
}>;

export type SessionAdapter = Readonly<{
  getSession: () => Promise<ApplicationSession | null>;
}>;

export type SupabaseAdapter = Readonly<{
  context: InfrastructureContext;
  session: SessionAdapter;
}>;

export type ProductionSupabaseAdapter = SupabaseAdapter &
  Readonly<{
    context: "production";
    client: SupabaseClient;
  }>;

export type MockSupabaseAdapter = SupabaseAdapter &
  Readonly<{
    context: "mock";
  }>;

export type DatabaseBoundary = Readonly<{
  context: "mock";
  connectionString?: never;
}>;

export type ProductionDatabaseBoundary = Readonly<{
  context: "production";
  connectionString: string;
}>;
