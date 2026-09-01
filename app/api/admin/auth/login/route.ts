import { NextRequest } from "next/server";

import {
  authenticateAdministrativePassword,
  GENERIC_AUTH_FAILURE,
  isTrustedAdminMutationOrigin,
} from "@/infrastructure/auth/admin-password-auth";
import { getServerEnvironment } from "@/config/server";
import { createServerSupabaseAdapter } from "@/infrastructure/supabase/server";
import type { ProductionSupabaseAdapter } from "@/infrastructure/supabase/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isTrustedAdminMutationOrigin(request)) {
    return Response.json(
      { message: GENERIC_AUTH_FAILURE, ok: false },
      { status: 400 }
    );
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

  try {
    const adapter = await createServerSupabaseAdapter();
    if (adapter.context !== "production") {
      return Response.json(
        { message: GENERIC_AUTH_FAILURE, ok: false },
        { status: 401 }
      );
    }
    const productionAdapter = adapter as ProductionSupabaseAdapter;
    const result = await authenticateAdministrativePassword(
      productionAdapter.client.auth,
      candidate,
      getServerEnvironment().ADMIN_ALLOWED_EMAILS
    );
    return Response.json(result, { status: result.ok ? 200 : 401 });
  } catch {
    return Response.json(
      { message: GENERIC_AUTH_FAILURE, ok: false },
      { status: 401 }
    );
  }
}
