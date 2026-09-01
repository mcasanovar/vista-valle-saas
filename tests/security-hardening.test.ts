import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";
import {
  generateReservationPublicId,
  isPublicReservationId,
} from "@/features/reservations/create-pay-at-property-reservation";
import { createInMemoryRequestLimiter } from "@/infrastructure/security/request-limiter";

const operationalTables = [
  "rooms",
  "room_images",
  "amenities",
  "room_amenities",
  "guests",
  "reservations",
  "reservation_holds",
  "room_blocks",
  "payments",
  "payment_events",
  "channel_sync_tasks",
  "audit_events",
  "notification_outbox",
  "assistant_interactions",
];

describe("security hardening contracts", () => {
  it("applies essential response headers without enabling third-party origins", async () => {
    const configured = await nextConfig.headers?.();
    const headers = configured?.[0]?.headers ?? [];
    const values = Object.fromEntries(
      headers.map((header) => [header.key.toLowerCase(), header.value])
    );

    expect(values["x-content-type-options"]).toBe("nosniff");
    expect(values["x-frame-options"]).toBe("DENY");
    expect(values["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(values["permissions-policy"]).toContain("camera=()");
    expect(values["content-security-policy"]).toContain("default-src 'self'");
    expect(values["content-security-policy"]).toContain(
      "frame-ancestors 'none'"
    );
    expect(values["content-security-policy"]).not.toContain("https:");
  });

  it("forces RLS and revokes direct access for every operational table", async () => {
    const sql = await readFile("supabase/rls/operational-tables.sql", "utf8");
    for (const table of operationalTables) {
      expect(sql).toContain(`public.${table} enable row level security`);
      expect(sql).toContain(`public.${table} force row level security`);
    }
    expect(sql).not.toMatch(/\bcreate policy\b|\bgrant\b/i);
  });

  it("uses unguessable v4 public identifiers and rejects a malformed public id", () => {
    expect(isPublicReservationId(generateReservationPublicId())).toBe(true);
    expect(
      isPublicReservationId("VV-12345678-1234-1234-1234-123456789abc")
    ).toBe(false);
  });

  it("limits repeated public writes per client window without trusting request payload", () => {
    let now = 0;
    const limiter = createInMemoryRequestLimiter(2, 60_000, () => now);
    const request = new Request("https://vista-valle.test/api/bookings", {
      headers: { "x-forwarded-for": "203.0.113.7" },
      method: "POST",
    });

    expect(limiter.consume(request)).toEqual({ allowed: true });
    expect(limiter.consume(request)).toEqual({ allowed: true });
    expect(limiter.consume(request)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    now = 60_000;
    expect(limiter.consume(request)).toEqual({ allowed: true });
  });

  it("keeps each exported administrator action behind the authorization boundary", async () => {
    const actionPaths = [
      "src/features/admin/manual-reservation-action.ts",
      "src/features/admin/reservation-actions.ts",
      "src/features/assistant/actions.ts",
      "src/features/channel-sync/actions.ts",
      "src/features/payments/actions.ts",
      "src/features/room-blocks/actions.ts",
    ];

    for (const actionPath of actionPaths) {
      const source = await readFile(actionPath, "utf8");
      expect(source).toContain('"use server"');
      expect(source).toContain("requireAdministrator");
      expect(source).not.toContain("console.");
    }
  });
});
