import { NextRequest } from "next/server";

import {
  GENERIC_AUTH_FAILURE,
  isTrustedAdminMutationOrigin,
} from "@/infrastructure/auth/admin-password-auth";
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

  try {
    const adapter = await createServerSupabaseAdapter();
    if (adapter.context === "production") {
      await (adapter as ProductionSupabaseAdapter).client.auth.signOut();
    }
  } catch {
    // A logout failure does not restore authorization; clients use a fixed login path.
  }

  return Response.json({ ok: true });
}
