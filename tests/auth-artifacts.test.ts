import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const operationalTables = [
  "rooms",
  "room_images",
  "amenities",
  "room_amenities",
  "guests",
  "reservations",
  "reservation_items",
  "reservation_holds",
  "room_blocks",
  "payments",
  "payment_events",
  "channel_sync_tasks",
  "channel_connections",
  "audit_events",
  "notification_outbox",
  "company_quotation_breakfast_catalog",
  "assistant_interactions",
  "operational_alerts",
  "company_quotations",
  "company_quotation_lines",
];

describe("declarative Supabase auth artifacts", () => {
  it("disables public signup", async () => {
    const config = await readFile("supabase/config.toml", "utf8");

    expect(config).toMatch(/enable_anonymous_sign_ins\s*=\s*false/);
    expect(config.match(/enable_signup\s*=\s*false/g)).toHaveLength(2);
  });

  it("enables RLS and revokes direct operational access without permissive policies", async () => {
    const sql = await readFile("supabase/rls/operational-tables.sql", "utf8");

    for (const table of operationalTables) {
      expect(sql).toContain(`public.${table} enable row level security`);
      expect(sql).toContain(`public.${table} force row level security`);
    }

    expect(sql).toMatch(/revoke all privileges/i);
    expect(sql).toContain("from anon, authenticated");
    expect(sql).not.toMatch(/\bgrant\b|\bcreate policy\b/i);
  });
});
