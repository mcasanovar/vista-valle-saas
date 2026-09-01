import { describe, expect, it, vi } from "vitest";

import {
  authenticateAdministrativePassword,
  GENERIC_AUTH_FAILURE,
  isTrustedAdminMutationOrigin,
  type PasswordAuthProvider,
} from "@/infrastructure/auth/admin-password-auth";

function provider(
  overrides: Partial<PasswordAuthProvider> = {}
): PasswordAuthProvider {
  return {
    getUser: async () => ({
      data: {
        user: {
          email: "admin@example.test",
          id: "admin-id",
          role: "authenticated",
        },
      },
      error: null,
    }),
    signInWithPassword: async () => ({ error: null }),
    signOut: async () => ({ error: null }),
    ...overrides,
  };
}

describe("administrative password authentication", () => {
  it("rejects malformed credentials generically without calling the provider", async () => {
    const signInWithPassword = vi.fn();
    const result = await authenticateAdministrativePassword(
      provider({ signInWithPassword }),
      { email: "not-an-email", password: "" },
      ["admin@example.test"]
    );
    expect(result).toEqual({ message: GENERIC_AUTH_FAILURE, ok: false });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("normalizes allowed email only after a remote user verification", async () => {
    const getUser = vi.fn(async () => ({
      data: {
        user: {
          email: " ADMIN@example.test ",
          id: "admin-id",
          role: "authenticated",
        },
      },
      error: null,
    }));
    const signInWithPassword = vi.fn(async () => ({ error: null }));
    await expect(
      authenticateAdministrativePassword(
        provider({ getUser, signInWithPassword }),
        { email: " Admin@Example.Test ", password: "password" },
        ["admin@example.test"]
      )
    ).resolves.toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.test",
      password: "password",
    });
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("returns the same safe error for provider and verification failures", async () => {
    const providerError = await authenticateAdministrativePassword(
      provider({
        signInWithPassword: async () => ({
          error: new Error("credentials leaked"),
        }),
      }),
      { email: "admin@example.test", password: "wrong" },
      ["admin@example.test"]
    );
    expect(JSON.stringify(providerError)).toBe(
      JSON.stringify({ message: GENERIC_AUTH_FAILURE, ok: false })
    );

    const signOut = vi.fn(async () => ({ error: null }));
    const verificationError = await authenticateAdministrativePassword(
      provider({
        getUser: async () => ({
          data: { user: null },
          error: new Error("expired token"),
        }),
        signOut,
      }),
      { email: "admin@example.test", password: "password" },
      ["admin@example.test"]
    );
    expect(verificationError).toEqual({
      message: GENERIC_AUTH_FAILURE,
      ok: false,
    });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("revokes a verified but non-allowlisted identity", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const result = await authenticateAdministrativePassword(
      provider({
        getUser: async () => ({
          data: {
            user: {
              email: "other@example.test",
              id: "other",
              role: "authenticated",
            },
          },
          error: null,
        }),
        signOut,
      }),
      { email: "other@example.test", password: "password" },
      ["admin@example.test"]
    );
    expect(result).toEqual({ message: GENERIC_AUTH_FAILURE, ok: false });
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("only accepts same-origin mutations and ignores hostile redirect input", async () => {
    expect(
      isTrustedAdminMutationOrigin(
        new Request("https://vista.test/api/admin/auth/login", {
          headers: { origin: "https://vista.test" },
        })
      )
    ).toBe(true);
    expect(
      isTrustedAdminMutationOrigin(
        new Request(
          "https://vista.test/api/admin/auth/login?redirect=https://evil.test",
          { headers: { origin: "https://evil.test" } }
        )
      )
    ).toBe(false);
  });
});
