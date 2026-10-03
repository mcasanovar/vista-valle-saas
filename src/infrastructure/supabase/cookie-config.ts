import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Admin session window (harden-admin-authentication, task 4.2): 12 hours,
 * replacing `@supabase/ssr`'s 400-day default. Chosen as a bounded window
 * that still covers a full working day for the single administrative
 * account without requiring a re-login mid-shift; `getUser()` on each
 * request refreshes the access token and re-issues the cookie, so an
 * active session keeps sliding forward — only a genuinely idle session
 * (12h with no admin request) expires.
 */
export const ADMIN_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * Shared cookie attributes for every `createServerClient` call that issues
 * the admin session cookie (`src/infrastructure/supabase/server.ts` and
 * `proxy.ts`). Both call sites must pass the exact same object — a mismatch
 * means whichever one runs last on a given request silently overwrites the
 * other's attributes on the same cookie name.
 */
export const ADMIN_SESSION_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  maxAge: ADMIN_SESSION_COOKIE_MAX_AGE_SECONDS,
  sameSite: "lax",
  secure: true,
};

/**
 * The anti-cache headers `@supabase/ssr` documents alongside a cookie write
 * (`node_modules/@supabase/ssr/src/types.ts`, `SetAllCookies`'s `headers`
 * parameter) — a response that sets session cookies must never be cached by
 * a shared/CDN cache, or one visitor's session could be served to another
 * (harden-admin-authentication, task 4.3).
 */
export const NO_STORE_SESSION_RESPONSE_HEADERS: Readonly<
  Record<string, string>
> = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

/**
 * Applies `NO_STORE_SESSION_RESPONSE_HEADERS` to a `Response` a Route
 * Handler is about to return. Used directly by `/api/admin/auth/{login,logout}`
 * because `createServerSupabaseAdapter`'s `setAll` (in `./server.ts`) only
 * has `next/headers`' `cookies()` available to it, which can mutate the
 * outgoing cookie jar but not set arbitrary response headers — the route
 * handler, which does construct the `Response`, is where these headers can
 * actually be attached. `proxy.ts` applies the same headers directly from
 * its own `setAll`, since it already holds the real `NextResponse`.
 */
export function withNoStoreSessionHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(NO_STORE_SESSION_RESPONSE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
