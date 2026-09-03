import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDirectory = path.resolve("drizzle");

describe("initial PostgreSQL migration", () => {
  it("contains the complete offline schema integrity contract", async () => {
    const migrationFiles = (await readdir(migrationsDirectory)).filter((file) =>
      file.endsWith(".sql")
    );

    expect(migrationFiles.length).toBeGreaterThan(0);

    const migration = (
      await Promise.all(
        migrationFiles.map((file) =>
          readFile(path.join(migrationsDirectory, file), "utf8")
        )
      )
    ).join("\n");

    expect(migration.match(/CREATE TABLE/g) ?? []).toHaveLength(19);
    expect(migration).toContain(
      'FOREIGN KEY ("assistant_interaction_id") REFERENCES "public"."assistant_interactions"("id")'
    );
    expect(migration).toContain('CONSTRAINT "reservations_interval_valid"');
    expect(migration).toContain('CONSTRAINT "payments_amount_positive"');
    expect(migration).toContain('CONSTRAINT "rooms_active_complete"');
    expect(migration).toContain('"check_in" date NOT NULL');
    expect(migration).toContain(
      '"occurred_at" timestamp with time zone NOT NULL'
    );
    expect(migration).toContain('"reservations_public_id_unique"');
    expect(migration).toContain('"notification_outbox_idempotency_key_unique"');
    expect(migration).toContain('"reservations_check_in_check_out_idx"');
    expect(migration).toContain('CREATE TABLE "channel_connections"');
    expect(migration).toContain(
      'CONSTRAINT "channel_connections_poll_result_consistent"'
    );
    expect(migration).toContain('"reservations_external_platform_ref_unique"');
    expect(migration).toContain('CREATE TABLE "operational_alerts"');
    expect(migration).not.toMatch(/^\s*(INSERT|UPDATE|DELETE|COPY)\s/im);
    expect(migration).not.toMatch(
      /SUPABASE|DATABASE_URL|MERCADO|RESEND|API_KEY/
    );
  });
});
