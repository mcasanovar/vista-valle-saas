import "server-only";

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

export async function requireAdministrator(): Promise<ApplicationSession> {
  const adapter = await createServerSupabaseAdapter();
  const environment = getServerEnvironment();
  const authorization = await authorizeAdministrator(
    adapter,
    environment.ADMIN_ALLOWED_EMAILS,
    environment.ADMIN_ALLOWED_USER_IDS
  );

  if (!authorization.authorized) {
    throw new Error(
      `Administrative authorization failed: ${authorization.reason}`
    );
  }

  return authorization.session;
}
