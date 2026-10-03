import { describe, expect, it, vi } from "vitest";

import {
  authorizeAdministrator,
  isAdministrativeSession,
} from "@/infrastructure/auth/authorization";
import { createMockSupabaseAdapter } from "@/infrastructure/supabase/mock";

const allowedEmails = ["mock-admin@example.test"];
const allowedUserIds = ["00000000-0000-4000-8000-000000000001"];

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
      authorizeAdministrator(
        adapter,
        [" MOCK-ADMIN@EXAMPLE.TEST "],
        [" 00000000-0000-4000-8000-000000000001 "]
      )
    ).resolves.toMatchObject({
      authorized: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects absent, unlisted, and non-authenticated sessions", async () => {
    await expect(
      authorizeAdministrator(
        createMockSupabaseAdapter(null),
        allowedEmails,
        allowedUserIds
      )
    ).resolves.toEqual({ authorized: false, reason: "missing_session" });

    expect(
      isAdministrativeSession(
        {
          user: {
            email: "other@example.test",
            id: "00000000-0000-4000-8000-000000000001",
            role: "authenticated",
          },
        },
        allowedEmails,
        allowedUserIds
      )
    ).toBe(false);
    expect(
      isAdministrativeSession(
        {
          user: {
            email: "mock-admin@example.test",
            id: "00000000-0000-4000-8000-000000000001",
            role: "anon",
          },
        },
        allowedEmails,
        allowedUserIds
      )
    ).toBe(false);
  });

  it("recognizes only the configured production administrator", () => {
    const productionAllowedEmails = ["vistavallespa@gmail.com"];
    const productionAllowedUserIds = ["00000000-0000-4000-8000-000000000002"];

    expect(
      isAdministrativeSession(
        {
          user: {
            email: "vistavallespa@gmail.com",
            id: "00000000-0000-4000-8000-000000000002",
            role: "authenticated",
          },
        },
        productionAllowedEmails,
        productionAllowedUserIds
      )
    ).toBe(true);
    expect(
      isAdministrativeSession(
        {
          user: {
            email: "someone-else@example.test",
            id: "00000000-0000-4000-8000-000000000002",
            role: "authenticated",
          },
        },
        productionAllowedEmails,
        productionAllowedUserIds
      )
    ).toBe(false);
  });

  it("rejects an allowlisted email claimed by an account whose user id is not allowlisted (harden-admin-authentication, task 7.1)", () => {
    expect(
      isAdministrativeSession(
        {
          user: {
            email: "mock-admin@example.test",
            id: "11111111-1111-4111-8111-111111111111",
            role: "authenticated",
          },
        },
        allowedEmails,
        allowedUserIds
      )
    ).toBe(false);
  });

  it("rejects an allowlisted user id whose account changed to a non-allowlisted email", () => {
    expect(
      isAdministrativeSession(
        {
          user: {
            email: "changed-email@example.test",
            id: "00000000-0000-4000-8000-000000000001",
            role: "authenticated",
          },
        },
        allowedEmails,
        allowedUserIds
      )
    ).toBe(false);
  });
});
