import { defineConfig } from "drizzle-kit";

// db:generate and db:check never open a connection, so this only matters for
// db:migrate. DATABASE_MIGRATION_URL should be a direct/session connection
// (not the pooled DATABASE_URL the app uses at runtime) - see design.md
// decision 1 in openspec/changes/configure-production-supabase.
const migrationUrl =
  process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  dialect: "postgresql",
  out: "drizzle",
  schema: "./src/persistence/schema.ts",
  dbCredentials: { url: migrationUrl },
});
