import { afterEach, describe, expect, it } from "vitest";

import { getServerEnvironment } from "@/config/server";
import { GET, POST } from "../app/api/internal/outbox/process/route";

const originalSecret = process.env.OUTBOX_PROCESSOR_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.OUTBOX_PROCESSOR_SECRET;
  else process.env.OUTBOX_PROCESSOR_SECRET = originalSecret;
});

describe("internal outbox processor route", () => {
  it("rejects a request without its bearer secret before processing", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/outbox/process", {
        method: "GET",
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "No autorizado." });
  });

  it("accepts Vercel's authorized GET cron request", async () => {
    process.env.OUTBOX_PROCESSOR_SECRET = "test-outbox-processor-secret-000000";
    const secret = getServerEnvironment().OUTBOX_PROCESSOR_SECRET;
    if (!secret) throw new Error("Test outbox processor secret is required");

    const response = await GET(
      new Request("http://localhost/api/internal/outbox/process", {
        headers: { authorization: `Bearer ${secret}` },
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      processed: 0,
      stopped: "no_ready",
    });
  });

  it("returns only the bounded processing summary when authorized", async () => {
    process.env.OUTBOX_PROCESSOR_SECRET = "test-outbox-processor-secret-000000";
    const secret = getServerEnvironment().OUTBOX_PROCESSOR_SECRET;
    if (!secret) throw new Error("Test outbox processor secret is required");

    const response = await POST(
      new Request("http://localhost/api/internal/outbox/process", {
        headers: { authorization: `Bearer ${secret}` },
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      processed: 0,
      stopped: "no_ready",
    });
  });
});
