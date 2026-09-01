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

export type PasswordAuthenticationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ message: typeof GENERIC_AUTH_FAILURE; ok: false }>;

const genericFailure = (): PasswordAuthenticationResult =>
  Object.freeze({ message: GENERIC_AUTH_FAILURE, ok: false });

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
  allowedEmails: readonly string[]
): Promise<PasswordAuthenticationResult> {
  const parsed = credentialsSchema.safeParse(candidate);
  if (!parsed.success) return genericFailure();

  try {
    const signedIn = await provider.signInWithPassword(parsed.data);
    if (signedIn.error) return genericFailure();

    const verified = await provider.getUser();
    if (verified.error || !verified.data.user) {
      await revoke(provider);
      return genericFailure();
    }

    const session = {
      user: {
        email: verified.data.user.email ?? null,
        id: verified.data.user.id,
        role: verified.data.user.role ?? null,
      },
    };
    if (!isAdministrativeSession(session, allowedEmails)) {
      await revoke(provider);
      return genericFailure();
    }

    return Object.freeze({ ok: true });
  } catch {
    return genericFailure();
  }
}

export function isTrustedAdminMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}
