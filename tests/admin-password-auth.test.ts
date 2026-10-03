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
      ["admin@example.test"],
      ["admin-id"]
    );
    expect(result).toEqual({
      message: GENERIC_AUTH_FAILURE,
      ok: false,
      reason: "invalid_input",
    });
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
        ["admin@example.test"],
        ["admin-id"]
      )
    ).resolves.toEqual({ ok: true, userId: "admin-id" });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.test",
      password: "password",
    });
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("returns the same safe message for provider and verification failures (the internal reason is for logging only, never serialized to the client)", async () => {
    const providerError = await authenticateAdministrativePassword(
      provider({
        signInWithPassword: async () => ({
          error: new Error("credentials leaked"),
        }),
      }),
      { email: "admin@example.test", password: "wrong" },
      ["admin@example.test"],
      ["admin-id"]
    );
    expect(providerError).toEqual({
      message: GENERIC_AUTH_FAILURE,
      ok: false,
      reason: "provider_rejected",
    });

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
      ["admin@example.test"],
      ["admin-id"]
    );
    expect(verificationError).toEqual({
      message: GENERIC_AUTH_FAILURE,
      ok: false,
      reason: "unverifiable_identity",
    });
    expect(signOut).toHaveBeenCalledOnce();

    // The client-facing response (built by the route, which strips `reason`)
    // must still be byte-identical regardless of which branch failed.
    function stripReason(result: typeof providerError) {
      if (result.ok) throw new Error("expected a failure result");
      return JSON.stringify({ message: result.message, ok: result.ok });
    }
    expect(stripReason(providerError)).toBe(stripReason(verificationError));
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
      ["admin@example.test"],
      ["admin-id"]
    );
    expect(result).toEqual({
      message: GENERIC_AUTH_FAILURE,
      ok: false,
      reason: "not_allowed",
    });
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

  it("also accepts DEV_TUNNEL_ORIGIN, but only that exact host, and never when unset", () => {
    const previous = process.env.DEV_TUNNEL_ORIGIN;
    process.env.DEV_TUNNEL_ORIGIN = "tunnel.ngrok-free.dev";
    try {
      // request.url reflects the local dev server, not the tunnel's public
      // host — this is the same shape a tunneled request actually arrives in.
      expect(
        isTrustedAdminMutationOrigin(
          new Request("http://localhost:3000/api/admin/auth/login", {
            headers: { origin: "https://tunnel.ngrok-free.dev" },
          })
        )
      ).toBe(true);
      expect(
        isTrustedAdminMutationOrigin(
          new Request("http://localhost:3000/api/admin/auth/login", {
            headers: { origin: "https://evil.test" },
          })
        )
      ).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.DEV_TUNNEL_ORIGIN;
      else process.env.DEV_TUNNEL_ORIGIN = previous;
    }

    delete process.env.DEV_TUNNEL_ORIGIN;
    expect(
      isTrustedAdminMutationOrigin(
        new Request("http://localhost:3000/api/admin/auth/login", {
          headers: { origin: "https://tunnel.ngrok-free.dev" },
        })
      )
    ).toBe(false);
  });

  it("rejects the dev tunnel origin outright on a Vercel production deployment, even if DEV_TUNNEL_ORIGIN is set", () => {
    const previousTunnel = process.env.DEV_TUNNEL_ORIGIN;
    const previousVercelEnv = process.env.VERCEL_ENV;
    process.env.DEV_TUNNEL_ORIGIN = "tunnel.ngrok-free.dev";
    process.env.VERCEL_ENV = "production";
    try {
      expect(
        isTrustedAdminMutationOrigin(
          new Request("http://localhost:3000/api/admin/auth/login", {
            headers: { origin: "https://tunnel.ngrok-free.dev" },
          })
        )
      ).toBe(false);
    } finally {
      if (previousTunnel === undefined) delete process.env.DEV_TUNNEL_ORIGIN;
      else process.env.DEV_TUNNEL_ORIGIN = previousTunnel;
      if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = previousVercelEnv;
    }
  });
});
