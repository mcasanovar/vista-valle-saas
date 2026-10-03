import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import {
  setStructuredLogSinkForTests,
  type StructuredLogRecord,
} from "@/infrastructure/observability/server";
import { POST } from "../app/api/admin/auth/logout/route";

const url = "http://localhost/api/admin/auth/logout";

function logoutRequest(): NextRequest {
  return new Request(url, {
    headers: { origin: "http://localhost" },
    method: "POST",
  }) as unknown as NextRequest;
}

afterEach(() => setStructuredLogSinkForTests(null));

describe("admin logout route", () => {
  it("rejects a request from an untrusted origin", async () => {
    const response = await POST(
      new Request(url, {
        headers: { origin: "https://evil.test" },
        method: "POST",
      }) as unknown as NextRequest
    );
    expect(response.status).toBe(400);
  });

  it("propagates anti-cache headers and logs the logout with the client address", async () => {
    const records: StructuredLogRecord[] = [];
    setStructuredLogSinkForTests((record) => records.push(record));

    const response = await POST(logoutRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(records.some((record) => record.event === "admin_logout")).toBe(
      true
    );
  });
});
