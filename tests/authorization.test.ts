import { describe, expect, it, vi } from "vitest";

import {
  authorizeAdministrator,
  isAdministrativeSession,
} from "@/infrastructure/auth/authorization";
import { createMockSupabaseAdapter } from "@/infrastructure/supabase/mock";

const allowedEmails = ["mock-admin@example.test"];

describe("administrative authorization", () => {
  it("accepts the mock administrator case-insensitively without network access", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const adapter = createMockSupabaseAdapter({
      user: {
        email: "MOCK-ADMIN@EXAMPLE.TEST",
        id: "00000000-0000-4000-8000-000000000001",
        role: "authenticated",
      },
    });

    await expect(
      authorizeAdministrator(adapter, [" MOCK-ADMIN@EXAMPLE.TEST "])
    ).resolves.toMatchObject({
      authorized: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects absent, unlisted, and non-authenticated sessions", async () => {
    await expect(
      authorizeAdministrator(createMockSupabaseAdapter(null), allowedEmails)
    ).resolves.toEqual({ authorized: false, reason: "missing_session" });

    expect(
      isAdministrativeSession(
        {
          user: {
            email: "other@example.test",
            id: "id",
            role: "authenticated",
          },
        },
        allowedEmails
      )
    ).toBe(false);
    expect(
      isAdministrativeSession(
        { user: { email: "mock-admin@example.test", id: "id", role: "anon" } },
        allowedEmails
      )
    ).toBe(false);
  });

  it("recognizes only the configured production administrator", () => {
    const productionAllowedEmails = ["vistavallespa@gmail.com"];

    expect(
      isAdministrativeSession(
        {
          user: {
            email: "vistavallespa@gmail.com",
            id: "id",
            role: "authenticated",
          },
        },
        productionAllowedEmails
      )
    ).toBe(true);
    expect(
      isAdministrativeSession(
        {
          user: {
            email: "someone-else@example.test",
            id: "id",
            role: "authenticated",
          },
        },
        productionAllowedEmails
      )
    ).toBe(false);
  });
});
