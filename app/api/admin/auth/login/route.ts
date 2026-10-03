import { NextRequest } from "next/server";

import {
  authenticateAdministrativePassword,
  GENERIC_AUTH_FAILURE,
  isTrustedAdminMutationOrigin,
} from "@/infrastructure/auth/admin-password-auth";
import { getServerEnvironment } from "@/config/server";
import { createServerSupabaseAdapter } from "@/infrastructure/supabase/server";
import { withNoStoreSessionHeaders } from "@/infrastructure/supabase/cookie-config";
import type { ProductionSupabaseAdapter } from "@/infrastructure/supabase/contracts";
import {
  getClientAddress,
  getSharedAdminLoginRequestLimiter,
} from "@/infrastructure/security/request-limiter";
import { writeStructuredLog } from "@/infrastructure/observability/server";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { recordAdminSessionAuditEvent } from "@/infrastructure/database/admin-session-audit";

export const dynamic = "force-dynamic";

function rateLimited(retryAfterSeconds: number) {
  return withNoStoreSessionHeaders(
    Response.json(
      { message: GENERIC_AUTH_FAILURE, ok: false },
      {
        headers: { "Retry-After": String(retryAfterSeconds) },
        status: 429,
      }
    )
  );
}

export async function POST(request: NextRequest) {
  if (!isTrustedAdminMutationOrigin(request)) {
    return Response.json(
      { message: GENERIC_AUTH_FAILURE, ok: false },
      { status: 400 }
    );
  }

  const limiter = getSharedAdminLoginRequestLimiter();
  const clientIp = getClientAddress(request);
  const clientCheck = limiter.checkClient(request);
  if (!clientCheck.allowed) {
    writeStructuredLog("warn", "admin_login.rate_limited", {
      clientIp,
      scope: "client",
    });
    return rateLimited(clientCheck.retryAfterSeconds);
  }

  let candidate: unknown;
  try {
    candidate = await request.json();
  } catch {
    return Response.json(
      { message: GENERIC_AUTH_FAILURE, ok: false },
      { status: 400 }
    );
  }

  const candidateEmail =
    candidate && typeof candidate === "object" && "email" in candidate
      ? String((candidate as { email: unknown }).email ?? "")
      : "";
  const emailCheck = limiter.checkEmail(candidateEmail);
  if (!emailCheck.allowed) {
    writeStructuredLog("warn", "admin_login.rate_limited", {
      clientIp,
      scope: "email",
    });
    return rateLimited(emailCheck.retryAfterSeconds);
  }

  try {
    const adapter = await createServerSupabaseAdapter();
    if (adapter.context !== "production") {
      return withNoStoreSessionHeaders(
        Response.json(
          { message: GENERIC_AUTH_FAILURE, ok: false },
          { status: 401 }
        )
      );
    }
    const productionAdapter = adapter as ProductionSupabaseAdapter;
    const environment = getServerEnvironment();
    const result = await authenticateAdministrativePassword(
      productionAdapter.client.auth,
      candidate,
      environment.ADMIN_ALLOWED_EMAILS,
      environment.ADMIN_ALLOWED_USER_IDS
    );

    const userId = result.ok ? result.userId : null;
    const boundary = createDatabaseBoundary();
    if (boundary.context === "production") {
      const db = createProductionDatabase(boundary);
      await recordAdminSessionAuditEvent(
        db,
        result.ok
          ? "admin_session.login_succeeded"
          : "admin_session.login_failed",
        userId
      );
    }
    writeStructuredLog(result.ok ? "info" : "warn", "admin_login.attempt", {
      clientIp,
      outcome: result.ok ? "succeeded" : "failed",
      reason: result.ok ? undefined : result.reason,
      userId,
    });

    // Only `message`/`ok` ever reach the client - `reason` is logging-only
    // (see `PasswordAuthenticationResult`) and must never be serialized here.
    const clientBody = result.ok
      ? { ok: true as const }
      : { message: result.message, ok: false as const };
    return withNoStoreSessionHeaders(
      Response.json(clientBody, { status: result.ok ? 200 : 401 })
    );
  } catch {
    return Response.json(
      { message: GENERIC_AUTH_FAILURE, ok: false },
      { status: 401 }
    );
  }
}
