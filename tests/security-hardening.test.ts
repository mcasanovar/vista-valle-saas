import { readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

import { timingSafeEqualStrings } from "@/infrastructure/security/timing-safe-equal";
import { runAssistantAgentLoop } from "@/features/assistant/agent-loop";
import { createScriptedAssistantModel } from "@/features/assistant/assistant-model-mock";
import { createAssistantToolRegistry } from "@/features/assistant/tool-registry";
import {
  createViewReservationTool,
  type ViewReservationReader,
} from "@/features/assistant/tools/view-reservation-tool";
import type { AdminReservationDetail } from "@/infrastructure/database/admin-reservation-source";

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
  "room_occupancy_prices",
  "payment_method_settings",
  "reservation_hold_items",
  "channel_platform_pauses",
  "assistant_threads",
  "assistant_messages",
  "assistant_memory_facts",
];

const ADMIN_PAGES_ROOT = path.join("app", "(admin-protected)", "admin");
const FEATURES_ROOT = "src/features";

/**
 * Extracts the body of every top-level `export async function NAME(...) { ... }`
 * in a source file by brace-counting from the opening `{`. Good enough for
 * this codebase's consistent style (no nested top-level function exports with
 * unbalanced braces inside string/template literals in these files).
 */
function extractExportedAsyncFunctionBodies(
  source: string
): ReadonlyArray<{ name: string; body: string }> {
  const results: Array<{ name: string; body: string }> = [];
  const pattern = /export async function (\w+)\s*\([^)]*\)[^{]*\{/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const name = match[1]!;
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;
    while (depth > 0 && index < source.length) {
      const char = source[index];
      if (char === "{") depth++;
      else if (char === "}") depth--;
      index++;
    }
    results.push({ body: source.slice(start, index - 1), name });
  }
  return results;
}

/** A body is compliant if it verifies directly, or purely delegates (a
 * single `return otherFunction(...)` call) to another export in the same
 * module that itself verifies — see `edit-reservation-dates-action.ts`. */
function bodyIsVerified(
  body: string,
  allBodies: ReadonlyArray<{ name: string; body: string }>,
  seen: ReadonlySet<string> = new Set()
): boolean {
  if (body.includes("requireAdministrator")) return true;
  const delegation = body
    .trim()
    .match(/^return\s+(\w+)\(/);
  if (!delegation) return false;
  const target = allBodies.find((entry) => entry.name === delegation[1]);
  if (!target || seen.has(target.name)) return false;
  return bodyIsVerified(target.body, allBodies, new Set([...seen, target.name]));
}

async function listFilesRecursively(
  root: string,
  predicate: (filePath: string) => boolean
): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listFilesRecursively(entryPath, predicate)));
    } else if (predicate(entryPath)) {
      results.push(entryPath);
    }
  }
  return results;
}

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

    const hsts = values["strict-transport-security"] ?? "";
    const maxAgeMatch = hsts.match(/max-age=(\d+)/);
    expect(maxAgeMatch).not.toBeNull();
    expect(Number(maxAgeMatch?.[1])).toBeGreaterThanOrEqual(60 * 60 * 24 * 365 * 2);
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

  it("keeps every Server Action module's exports behind the authorization boundary", async () => {
    const candidatePaths = await listFilesRecursively(FEATURES_ROOT, (filePath) =>
      filePath.endsWith(".ts")
    );

    const directiveFiles: string[] = [];
    for (const filePath of candidatePaths) {
      const source = await readFile(filePath, "utf8");
      if (/^["']use server["'];/.test(source.trimStart())) {
        directiveFiles.push(filePath);
      }
    }

    expect(directiveFiles.length).toBeGreaterThanOrEqual(21);

    // Collected across every directive file first, so a function that
    // purely delegates to a verified export of a *different* module (e.g.
    // `edit-reservation-dates-action.ts` delegating to
    // `edit-reservation-stay-action.ts`) can still be resolved by name.
    const perFileBodies = new Map<
      string,
      ReadonlyArray<{ name: string; body: string }>
    >();
    for (const filePath of directiveFiles) {
      const source = await readFile(filePath, "utf8");
      expect(source, `${filePath} must not log to the console`).not.toContain(
        "console."
      );
      perFileBodies.set(filePath, extractExportedAsyncFunctionBodies(source));
    }
    const allBodies = Array.from(perFileBodies.values()).flat();

    for (const [filePath, bodies] of perFileBodies) {
      expect(
        bodies.length,
        `${filePath} exports no async function to check`
      ).toBeGreaterThan(0);
      for (const { name, body } of bodies) {
        expect(
          bodyIsVerified(body, allBodies),
          `${filePath}: exported function ${name} must call requireAdministrator() (directly or by delegating to a verified export)`
        ).toBe(true);
      }
    }
  });

  it("issues the admin session cookie with HttpOnly, Secure and a bounded Max-Age from both writers", async () => {
    const { ADMIN_SESSION_COOKIE_OPTIONS, ADMIN_SESSION_COOKIE_MAX_AGE_SECONDS } =
      await import("@/infrastructure/supabase/cookie-config");

    expect(ADMIN_SESSION_COOKIE_OPTIONS.httpOnly).toBe(true);
    expect(ADMIN_SESSION_COOKIE_OPTIONS.secure).toBe(true);
    expect(ADMIN_SESSION_COOKIE_OPTIONS.maxAge).toBe(
      ADMIN_SESSION_COOKIE_MAX_AGE_SECONDS
    );
    expect(ADMIN_SESSION_COOKIE_MAX_AGE_SECONDS).toBeLessThan(60 * 60 * 24 * 400);

    const serverSource = await readFile(
      "src/infrastructure/supabase/server.ts",
      "utf8"
    );
    const proxySource = await readFile("proxy.ts", "utf8");
    expect(serverSource).toContain("cookieOptions: ADMIN_SESSION_COOKIE_OPTIONS");
    expect(proxySource).toContain("cookieOptions: ADMIN_SESSION_COOKIE_OPTIONS");
  });

  it("propagates the anti-cache headers the session library documents alongside cookie writes", async () => {
    const { withNoStoreSessionHeaders, NO_STORE_SESSION_RESPONSE_HEADERS } =
      await import("@/infrastructure/supabase/cookie-config");

    const response = withNoStoreSessionHeaders(new Response("{}"));
    for (const [key, value] of Object.entries(NO_STORE_SESSION_RESPONSE_HEADERS)) {
      expect(response.headers.get(key)).toBe(value);
    }

    const proxySource = await readFile("proxy.ts", "utf8");
    expect(proxySource).toContain("response.headers.set(key, value)");
  });

  it("compares internal endpoint secrets in constant time, for equal and unequal lengths", () => {
    expect(timingSafeEqualStrings("Bearer abc123", "Bearer abc123")).toBe(true);
    expect(timingSafeEqualStrings("Bearer abc123", "Bearer abc124")).toBe(false);
    expect(timingSafeEqualStrings("Bearer abc", "Bearer abc123")).toBe(false);
    expect(timingSafeEqualStrings("", "")).toBe(true);
  });

  it("never commits a real ADMIN_ALLOWED_EMAILS value to a versioned file (harden-admin-authentication, task 11.2)", async () => {
    // Basic ERE (git's grep has no PCRE lookahead here), filtered in JS for
    // the .test/.example exemption — broad match first, narrow after.
    const pattern = "ADMIN_ALLOWED_EMAILS=[^<\" ]*@[^<\" ]+";
    let matches: string[] = [];
    try {
      const { stdout } = await execFileAsync("git", [
        "grep",
        "-InE",
        pattern,
        "--",
        ":!tests/**",
      ]);
      matches = stdout.split("\n").filter(Boolean);
    } catch (error) {
      // git grep exits 1 when there are no matches - that's the passing case.
      const exitCode = (error as { code?: number }).code;
      if (exitCode !== 1) throw error;
    }

    const realEmailMatches = matches.filter(
      (line) => !/@[^@\s]*\.(test|example)\b/.test(line)
    );
    expect(
      realEmailMatches,
      `found a real admin email committed:\n${realEmailMatches.join("\n")}`
    ).toEqual([]);
  });

  it("never includes a guest's email, phone, or RUT in the body built for the model provider (harden-admin-authentication, task 12.3)", async () => {
    const detail: AdminReservationDetail = {
      auditEvents: [],
      channelSyncTasks: [],
      checkIn: "2030-02-01",
      checkOut: "2030-02-03",
      createdAt: new Date("2030-01-01T00:00:00Z"),
      externalPlatform: null,
      guest: {
        company: "Acme SpA",
        email: "ana@example.com",
        firstName: "Ana",
        lastName: "Pérez",
        phone: "+56911111111",
        rut: "11.111.111-1",
      },
      guestComment: "Dejar la llave bajo la maceta.",
      id: "reservation-1",
      invoiceRequest: {
        businessActivity: "Comercio",
        email: "facturacion@acme.cl",
        name: "Acme SpA",
        phone: "+56922222222",
        rut: "76.111.111-1",
      },
      items: [],
      origin: "website",
      payments: [],
      publicId: "VV-1",
      status: "confirmed",
      totalClp: 100_000,
    };
    const reader: ViewReservationReader = { async get() { return detail; } };
    const registry = createAssistantToolRegistry([createViewReservationTool(reader)]);
    const model = createScriptedAssistantModel([
      {
        kind: "tool_calls",
        toolCalls: [
          { arguments: { reservationId: "reservation-1" }, id: "call-1", name: "ver_reserva" },
        ],
      },
      { kind: "text", text: "La reserva está confirmada." },
    ]);

    const result = await runAssistantAgentLoop(
      model,
      registry,
      {
        actorUserId: "admin-1",
        operationalContext: {
          rooms: [],
          today: "2030-01-01",
          validManualOrigins: [],
          validReservationStatusTransitions: [],
          validRoomBlockStatuses: [],
        },
      },
      {
        history: [],
        instruction: "Muéstrame el detalle de la reserva reservation-1",
        systemPrefix: "Eres el asistente administrativo de Vista Valle.",
      }
    );

    const bodySentToProvider = JSON.stringify(result.appendedMessages);
    expect(bodySentToProvider).not.toContain("ana@example.com");
    expect(bodySentToProvider).not.toContain("+56911111111");
    expect(bodySentToProvider).not.toContain("11.111.111-1");
    expect(bodySentToProvider).not.toContain("facturacion@acme.cl");
    expect(bodySentToProvider).not.toContain("Acme SpA");
    expect(bodySentToProvider).not.toContain("maceta");
  });

  it("does not default a copied .env.example to the mock configuration context", async () => {
    const envExample = await readFile(".env.example", "utf8");
    const values = Object.fromEntries(
      envExample
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separatorIndex = line.indexOf("=");
          return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
        })
    );

    expect(values.VISTA_VALLE_CONFIG_CONTEXT).not.toBe("mock");
    expect(values.NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT).not.toBe("mock");
  });

  it("keeps every admin page dynamic so it can never be served from a shared cache", async () => {
    const pagePaths = [
      ...(await listFilesRecursively(ADMIN_PAGES_ROOT, (filePath) =>
        filePath.endsWith("page.tsx")
      )),
      ...(await listFilesRecursively(path.join("app", "admin"), (filePath) =>
        filePath.endsWith("page.tsx")
      )),
      path.join(ADMIN_PAGES_ROOT, "layout.tsx"),
    ];

    for (const pagePath of pagePaths) {
      const source = await readFile(pagePath, "utf8");
      expect(
        source,
        `${pagePath} must export dynamic = "force-dynamic"`
      ).toMatch(/export const dynamic = ["']force-dynamic["'];/);
    }
  });

  it("binds the origin on every non-GET admin API route", async () => {
    const routePaths = await listFilesRecursively(
      path.join("app", "api", "admin"),
      (filePath) => filePath.endsWith("route.ts")
    );

    expect(routePaths.length).toBeGreaterThanOrEqual(10);

    for (const routePath of routePaths) {
      const source = await readFile(routePath, "utf8");
      const hasNonGetHandler = /export async function (POST|PUT|PATCH|DELETE)\b/.test(
        source
      );
      if (!hasNonGetHandler) continue;
      expect(
        source,
        `${routePath} has a non-GET handler and must call isTrustedAdminMutationOrigin`
      ).toContain("isTrustedAdminMutationOrigin");
    }
  });

  it("requires every protected admin page to verify the administrative session", async () => {
    const pagePaths = await listFilesRecursively(
      ADMIN_PAGES_ROOT,
      (filePath) => filePath.endsWith("page.tsx")
    );

    expect(pagePaths.length).toBeGreaterThanOrEqual(14);

    for (const pagePath of pagePaths) {
      const source = await readFile(pagePath, "utf8");
      expect(source, `${pagePath} must call requireAdministrator()`).toContain(
        "requireAdministrator"
      );
    }
  });
});
