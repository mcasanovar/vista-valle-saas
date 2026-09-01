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

export function isAdministrativeSession(
  session: ApplicationSession | null,
  allowedEmails: readonly string[]
): session is ApplicationSession {
  if (!session) {
    return false;
  }

  const email = session.user.email?.trim().toLowerCase();

  return Boolean(
    email &&
    session.user.role === "authenticated" &&
    allowedEmails.some(
      (allowedEmail) => allowedEmail.trim().toLowerCase() === email
    )
  );
}

export async function authorizeAdministrator(
  adapter: SupabaseAdapter,
  allowedEmails: readonly string[]
): Promise<AdministrativeAuthorization> {
  const session = await adapter.session.getSession();

  if (!session) {
    return { authorized: false, reason: "missing_session" };
  }

  if (!isAdministrativeSession(session, allowedEmails)) {
    return { authorized: false, reason: "not_allowed" };
  }

  return { authorized: true, session };
}

export async function requireAdministrator(): Promise<ApplicationSession> {
  const adapter = await createServerSupabaseAdapter();
  const authorization = await authorizeAdministrator(
    adapter,
    getServerEnvironment().ADMIN_ALLOWED_EMAILS
  );

  if (!authorization.authorized) {
    throw new Error(
      `Administrative authorization failed: ${authorization.reason}`
    );
  }

  return authorization.session;
}
