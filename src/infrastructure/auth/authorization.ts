import "server-only";

import { cache } from "react";

import { getServerEnvironment } from "@/config/server";
import {
  type ApplicationSession,
  type SupabaseAdapter,
} from "@/infrastructure/supabase/contracts";
import { createServerSupabaseAdapter } from "@/infrastructure/supabase/server";

export type AdministrativeAuthorization =
  | Readonly<{ authorized: true; session: ApplicationSession }>
  | Readonly<{ authorized: false; reason: "missing_session" | "not_allowed" }>;

/**
 * Authorization requires the email **and** the user id to both be on their
 * respective allowlists (harden-admin-authentication, task 7.1) — the
 * `authenticated` role alone is not an authorization signal, since every
 * account with a valid session has it. Anchoring to the user id closes two
 * gaps an email-only check leaves open: an allowlisted email with no
 * account yet (claimable by anyone who signs up with it), and an existing
 * account that changes its email to one on the allowlist.
 */
export function isAdministrativeSession(
  session: ApplicationSession | null,
  allowedEmails: readonly string[],
  allowedUserIds: readonly string[]
): session is ApplicationSession {
  if (!session) {
    return false;
  }

  const email = session.user.email?.trim().toLowerCase();
  const userId = session.user.id?.trim().toLowerCase();

  return Boolean(
    email &&
    session.user.role === "authenticated" &&
    allowedEmails.some(
      (allowedEmail) => allowedEmail.trim().toLowerCase() === email
    ) &&
    userId &&
    allowedUserIds.some(
      (allowedUserId) => allowedUserId.trim().toLowerCase() === userId
    )
  );
}

export async function authorizeAdministrator(
  adapter: SupabaseAdapter,
  allowedEmails: readonly string[],
  allowedUserIds: readonly string[]
): Promise<AdministrativeAuthorization> {
  const session = await adapter.session.getSession();

  if (!session) {
    return { authorized: false, reason: "missing_session" };
  }

  if (!isAdministrativeSession(session, allowedEmails, allowedUserIds)) {
    return { authorized: false, reason: "not_allowed" };
  }

  return { authorized: true, session };
}

/**
 * Memoized for the lifetime of a single request (`React.cache`), not
 * per-call: `requireAdministrator()` is now called from every protected
 * page *and* every admin data-access function it uses (harden-admin-
 * authentication, tasks 1.1/1.2), on top of the layout's own check. Each
 * of those previously ran its own `getUser()` round trip against Supabase.
 * Right after a fresh login, Supabase's refresh-token rotation makes that
 * dangerous, not just slow: a Server Component can't persist a refreshed
 * cookie (`createServerSupabaseAdapter`'s `setAll` silently no-ops there),
 * so a first call's refresh attempt can consume/rotate the refresh token
 * without saving the new one, leaving a second, unmemoized call in the
 * same request to retry against a token Supabase already invalidated —
 * observed as the admin dashboard hanging for ~57s and then failing after
 * a fresh login. One verification per request removes the race entirely.
 */
export const getCachedAdministrativeAuthorization = cache(
  async (): Promise<AdministrativeAuthorization> => {
    const adapter = await createServerSupabaseAdapter();
    const environment = getServerEnvironment();
    return authorizeAdministrator(
      adapter,
      environment.ADMIN_ALLOWED_EMAILS,
      environment.ADMIN_ALLOWED_USER_IDS
    );
  }
);

export async function requireAdministrator(): Promise<ApplicationSession> {
  const authorization = await getCachedAdministrativeAuthorization();

  if (!authorization.authorized) {
    throw new Error(
      `Administrative authorization failed: ${authorization.reason}`
    );
  }

  return authorization.session;
}
