import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  setStructuredLogSinkForTests,
  type StructuredLogRecord,
} from "@/infrastructure/observability/server";
import { POST } from "../app/api/admin/auth/login/route";

const url = "http://localhost/api/admin/auth/login";

function loginRequest(
  options: Readonly<{ clientAddress: string; email?: string }>
): NextRequest {
  return new Request(url, {
    body: JSON.stringify({
      email: options.email ?? "admin@example.test",
      password: "irrelevant",
    }),
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "x-forwarded-for": options.clientAddress,
    },
    method: "POST",
  }) as unknown as NextRequest;
}

afterEach(() => setStructuredLogSinkForTests(null));

describe("admin login route", () => {
  it("logs the client address without ever including the password, email, or any token", async () => {
    const records: StructuredLogRecord[] = [];
    setStructuredLogSinkForTests((record) => records.push(record));

    const clientAddress = "198.51.100.77";
    const email = "logged-admin@example.test";
    // Nine attempts trips the per-client limit, guaranteeing a log event
    // fires even though the mock context short-circuits before the
    // success/failure attempt log (that branch only runs in production).
    for (let attempt = 0; attempt < 9; attempt += 1) {
      await POST(loginRequest({ clientAddress, email }));
    }

    expect(records.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(records);
    expect(serialized).toContain(clientAddress);
    expect(serialized).not.toContain("irrelevant"); // the password used above
    expect(serialized).not.toContain(email);
    expect(serialized).not.toMatch(/bearer|token/i);
  });


  it("rejects a request from an untrusted origin before touching the limiter", async () => {
    const response = await POST(
      new Request(url, {
        body: JSON.stringify({ email: "a@b.test", password: "x" }),
        headers: { "content-type": "application/json", origin: "https://evil.test" },
        method: "POST",
      }) as unknown as NextRequest
    );
    expect(response.status).toBe(400);
  });

  it("propagates anti-cache headers on every response, including a failed login", async () => {
    const response = await POST(
      loginRequest({ clientAddress: "198.51.100.10", email: "no-such-admin@example.test" })
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
  });

  it("rate limits repeated attempts from the same client address, with a different email each time", async () => {
    const clientAddress = "203.0.113.50";
    let lastResponse: Response | undefined;
    for (let attempt = 0; attempt < 9; attempt += 1) {
      lastResponse = await POST(
        loginRequest({
          clientAddress,
          email: `attacker-${attempt}@example.test`,
        })
      );
    }

    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
    expect(await lastResponse?.json()).toEqual({
      message: "No fue posible iniciar sesión.",
      ok: false,
    });
  });

  it("rate limits repeated attempts against the same email from different client addresses", async () => {
    const email = "targeted-admin@example.test";
    let lastResponse: Response | undefined;
    for (let attempt = 0; attempt < 11; attempt += 1) {
      lastResponse = await POST(
        loginRequest({ clientAddress: `203.0.114.${attempt}`, email })
      );
    }

    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("Retry-After")).toBeTruthy();
  });
});
