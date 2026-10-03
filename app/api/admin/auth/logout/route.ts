import { NextRequest } from "next/server";

import {
  GENERIC_AUTH_FAILURE,
  isTrustedAdminMutationOrigin,
} from "@/infrastructure/auth/admin-password-auth";
import { createServerSupabaseAdapter } from "@/infrastructure/supabase/server";
import { withNoStoreSessionHeaders } from "@/infrastructure/supabase/cookie-config";
import type { ProductionSupabaseAdapter } from "@/infrastructure/supabase/contracts";
import { getClientAddress } from "@/infrastructure/security/request-limiter";
import { writeStructuredLog } from "@/infrastructure/observability/server";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { recordAdminSessionAuditEvent } from "@/infrastructure/database/admin-session-audit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isTrustedAdminMutationOrigin(request)) {
    return Response.json(
      { message: GENERIC_AUTH_FAILURE, ok: false },
      { status: 400 }
    );
  }

  let userId: string | null = null;
  try {
    const adapter = await createServerSupabaseAdapter();
    if (adapter.context === "production") {
      const productionAdapter = adapter as ProductionSupabaseAdapter;
      userId =
        (await productionAdapter.client.auth.getUser()).data.user?.id ?? null;
      await productionAdapter.client.auth.signOut();
    }
  } catch {
    // A logout failure does not restore authorization; clients use a fixed login path.
  }

  const boundary = createDatabaseBoundary();
  if (boundary.context === "production") {
    const db = createProductionDatabase(boundary);
    await recordAdminSessionAuditEvent(db, "admin_session.logout", userId);
  }
  writeStructuredLog("info", "admin_logout", {
    clientIp: getClientAddress(request),
    userId,
  });

  return withNoStoreSessionHeaders(Response.json({ ok: true }));
}
