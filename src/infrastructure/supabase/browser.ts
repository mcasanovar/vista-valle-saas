import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnvironment } from "@/config/public";
import {
  type ApplicationSession,
  type ProductionSupabaseAdapter,
  type SupabaseAdapter,
} from "@/infrastructure/supabase/contracts";
import { createMockSupabaseAdapter } from "@/infrastructure/supabase/mock";

function toApplicationSession(
  session: Awaited<
    ReturnType<ReturnType<typeof createBrowserClient>["auth"]["getSession"]>
  >["data"]["session"]
): ApplicationSession | null {
  if (!session) {
    return null;
  }

  return {
    user: {
      email: session.user.email ?? null,
      id: session.user.id,
      role: session.user.role ?? null,
    },
  };
}

export function createBrowserSupabaseAdapter(): SupabaseAdapter {
  const environment = getPublicEnvironment();

  if (environment.NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT === "mock") {
    return createMockSupabaseAdapter();
  }

  const client = createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const adapter: ProductionSupabaseAdapter = {
    client,
    context: "production",
    session: {
      getSession: async () => {
        const { data, error } = await client.auth.getSession();

        if (error) {
          throw new Error("Unable to read the Supabase browser session");
        }

        return toApplicationSession(data.session);
      },
    },
  };

  return adapter;
}
