import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnvironment } from "@/config/public";
import { getServerEnvironment } from "@/config/server";

export async function proxy(request: NextRequest) {
  const publicEnvironment = getPublicEnvironment();
  const serverEnvironment = getServerEnvironment();

  if (
    publicEnvironment.NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT !==
    serverEnvironment.VISTA_VALLE_CONFIG_CONTEXT
  ) {
    throw new Error(
      "Invalid environment configuration: public and server configuration contexts must match"
    );
  }

  if (serverEnvironment.VISTA_VALLE_CONFIG_CONTEXT === "mock") {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const client = createServerClient(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    publicEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, options, value }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await client.auth.getUser();
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
