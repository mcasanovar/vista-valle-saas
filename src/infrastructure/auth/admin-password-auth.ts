import "server-only";

import { z } from "zod";

import { isAdministrativeSession } from "./authorization";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
});

export const GENERIC_AUTH_FAILURE = "No fue posible iniciar sesión.";

type RemoteUser = Readonly<{
  email?: string | null;
  id: string;
  role?: string | null;
}>;

export type PasswordAuthProvider = Readonly<{
  getUser: () => Promise<
    Readonly<{ data: Readonly<{ user: RemoteUser | null }>; error: unknown }>
  >;
  signInWithPassword: (
    credentials: Readonly<{ email: string; password: string }>
  ) => Promise<Readonly<{ error: unknown }>>;
  signOut: () => Promise<unknown>;
}>;

export type PasswordAuthenticationFailureReason =
  | "invalid_input"
  | "not_allowed"
  | "provider_rejected"
  | "unverifiable_identity";

export type PasswordAuthenticationResult =
  | Readonly<{ ok: true; userId: string }>
  | Readonly<{
      message: typeof GENERIC_AUTH_FAILURE;
      ok: false;
      /** Never sent to the client - every failure branch returns the same
       * generic message; this is for `writeStructuredLog` only (task 5.4). */
      reason: PasswordAuthenticationFailureReason;
    }>;

const genericFailure = (
  reason: PasswordAuthenticationFailureReason
): PasswordAuthenticationResult =>
  Object.freeze({ message: GENERIC_AUTH_FAILURE, ok: false, reason });

async function revoke(provider: PasswordAuthProvider) {
  try {
    await provider.signOut();
  } catch {
    // The caller still fails closed if the provider cannot confirm revocation.
  }
}

/** Authenticates, then always fetches the user remotely before allowlisting it. */
export async function authenticateAdministrativePassword(
  provider: PasswordAuthProvider,
  candidate: unknown,
  allowedEmails: readonly string[],
  allowedUserIds: readonly string[]
): Promise<PasswordAuthenticationResult> {
  const parsed = credentialsSchema.safeParse(candidate);
  if (!parsed.success) return genericFailure("invalid_input");

  try {
    const signedIn = await provider.signInWithPassword(parsed.data);
    if (signedIn.error) return genericFailure("provider_rejected");

    const verified = await provider.getUser();
    if (verified.error || !verified.data.user) {
      await revoke(provider);
      return genericFailure("unverifiable_identity");
    }

    const session = {
      user: {
        email: verified.data.user.email ?? null,
        id: verified.data.user.id,
        role: verified.data.user.role ?? null,
      },
    };
    if (!isAdministrativeSession(session, allowedEmails, allowedUserIds)) {
      await revoke(provider);
      return genericFailure("not_allowed");
    }

    return Object.freeze({ ok: true, userId: session.user.id });
  } catch {
    return genericFailure("provider_rejected");
  }
}

/**
 * `request.url` is built from the raw socket `next dev` accepted, not any
 * `X-Forwarded-*` header — behind a TLS-terminating tunnel (ngrok) it
 * resolves to `http(s)://localhost:<port>/...` regardless of the public
 * host the browser actually used, so it can never equal the browser's
 * `Origin` there. `DEV_TUNNEL_ORIGIN` is the same explicit, developer-set
 * escape hatch `next.config.ts` already uses for that scenario — trusting
 * the `X-Forwarded-*` headers themselves would accept a client-spoofed
 * origin, since nothing here can verify they were actually set by a
 * trusted proxy. Unset in every real deployment (see `next.config.ts`).
 *
 * Inert in production (harden-admin-authentication, task 6.4):
 * `VERCEL_ENV` is set by the platform itself, not by this project's own
 * configuration, so a value left over in a deployment's environment by
 * mistake can't widen the trusted origin set there the way a misconfigured
 * `DEV_TUNNEL_ORIGIN` application variable could.
 */
export function isTrustedAdminMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  if (origin === new URL(request.url).origin) return true;
  if (process.env.VERCEL_ENV === "production") return false;

  const devTunnelOrigin = process.env.DEV_TUNNEL_ORIGIN;
  return devTunnelOrigin !== undefined && origin === `https://${devTunnelOrigin}`;
}
