import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnvironment } from "@/config/public";
import { getServerEnvironment } from "@/config/server";
import {
  type ProductionSupabaseAdapter,
  type SupabaseAdapter,
} from "@/infrastructure/supabase/contracts";
import { createMockSupabaseAdapter } from "@/infrastructure/supabase/mock";

function toVerifiedApplicationSession(
  user: Awaited<
    ReturnType<ReturnType<typeof createServerClient>["auth"]["getUser"]>
  >["data"]["user"]
) {
  if (!user) {
    return null;
  }

  return {
    user: {
      email: user.email ?? null,
      id: user.id,
      role: user.role ?? null,
    },
  };
}

export async function createServerSupabaseAdapter(): Promise<SupabaseAdapter> {
  const environment = getServerEnvironment();
  const publicEnvironment = getPublicEnvironment();

  if (
    publicEnvironment.NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT !==
    environment.VISTA_VALLE_CONFIG_CONTEXT
  ) {
    throw new Error(
      "Invalid environment configuration: public and server configuration contexts must match"
    );
  }

  if (environment.VISTA_VALLE_CONFIG_CONTEXT === "mock") {
    return createMockSupabaseAdapter();
  }

  const cookieStore = await cookies();
  const client = createServerClient(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    publicEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, options, value }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot write cookies; Route Handlers and actions can.
          }
        },
      },
    }
  );

  const adapter: ProductionSupabaseAdapter = {
    client,
    context: "production",
    session: {
      getSession: async () => {
        const { data, error } = await client.auth.getUser();

        if (error) {
          throw new Error("Unable to verify the Supabase server session");
        }

        return toVerifiedApplicationSession(data.user);
      },
    },
  };

  return adapter;
}
