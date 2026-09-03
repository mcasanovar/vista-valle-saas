import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import postgres from "postgres";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;

if (!integrationUrl) {
  console.log(
    "PostgreSQL integration tests skipped: VISTA_VALLE_POSTGRES_INTEGRATION_URL is not set."
  );
  process.exit(0);
}

const parsedUrl = new URL(integrationUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname).replace(/^\//, "");

if (!/(?:_test|_integration)$/i.test(databaseName)) {
  throw new Error(
    "VISTA_VALLE_POSTGRES_INTEGRATION_URL must target a dedicated database ending in _test or _integration."
  );
}

if (process.env.VISTA_VALLE_CONFIG_CONTEXT === "mock") {
  throw new Error(
    "PostgreSQL integration tests must not run under VISTA_VALLE_CONFIG_CONTEXT=mock."
  );
}

const sql = postgres(integrationUrl, { max: 1 });

const journalPath = path.resolve("drizzle/meta/_journal.json");
const journal = JSON.parse(await readFile(journalPath, "utf8"));
const migrationStatements = [];
for (const entry of journal.entries) {
  const migrationPath = path.resolve(`drizzle/${entry.tag}.sql`);
  const migration = await readFile(migrationPath, "utf8");
  migrationStatements.push(
    ...migration
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean)
  );
}

async function resetSchema() {
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await sql.unsafe("CREATE SCHEMA public");
  await sql.unsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  for (const statement of migrationStatements) await sql.unsafe(statement);
}

try {
  await resetSchema();
  const child = spawn(
    "npx",
    [
      "vitest",
      "run",
      "tests/postgres-reservation.integration.test.ts",
      "tests/postgres-room-block.integration.test.ts",
      "tests/postgres-operational-alerts.integration.test.ts",
      "tests/postgres-admin-pending-payments.integration.test.ts",
      "tests/postgres-reservation-summary.integration.test.ts",
      "tests/postgres-alerts-end-to-end.integration.test.ts",
      "--environment",
      "node",
    ],
    {
      env: {
        ...process.env,
        POSTGRES_RESERVATION_INTEGRATION_ENABLED: "true",
      },
      stdio: "inherit",
    }
  );

  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Vitest exited from signal ${signal}`));
      else resolve(code ?? 1);
    });
  });
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await sql.unsafe("DROP SCHEMA IF EXISTS public CASCADE");
  await sql.end({ timeout: 5 });
}
