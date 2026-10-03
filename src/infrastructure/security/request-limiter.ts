import "server-only";

export type RequestLimiter = Readonly<{
  consume: (
    request: Request
  ) =>
    | Readonly<{ allowed: true }>
    | Readonly<{ allowed: false; retryAfterSeconds: number }>;
}>;

/** The same client-identifying value every limiter in this module keys on - exported for callers that also want it for logging (e.g. the admin login route). */
export function getClientAddress(request: Request) {
  return clientKey(request);
}

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anonymous"
  );
}

type CounterEntry = { count: number; resetAt: number };

/** Keyed sliding-window counter shared by every in-memory limiter below. */
function createKeyedCounter(
  limit: number,
  windowMs: number,
  now: () => number
) {
  const entries = new Map<string, CounterEntry>();
  return {
    hit(key: string) {
      const time = now();
      const current = entries.get(key);
      const entry =
        !current || current.resetAt <= time
          ? { count: 0, resetAt: time + windowMs }
          : current;
      entry.count += 1;
      entries.set(key, entry);
      if (entry.count <= limit) return { allowed: true as const };
      return {
        allowed: false as const,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((entry.resetAt - time) / 1000)
        ),
      };
    },
  };
}

/**
 * A process-local limiter. Correct while Vista Valle runs as a single
 * long-lived server process (the current deployment target - see
 * openspec/changes/configure-production-supabase/design.md); it does not
 * protect a multi-instance deployment, since each instance would count
 * independently. Replace with a shared adapter (e.g. Redis/Upstash) before
 * deploying behind multiple serverless instances.
 */
export function createInMemoryRequestLimiter(
  limit = 10,
  windowMs = 60_000,
  now: () => number = Date.now
): RequestLimiter {
  const counter = createKeyedCounter(limit, windowMs, now);

  return Object.freeze({
    consume(request) {
      return Object.freeze(counter.hit(clientKey(request)));
    },
  });
}

const publicBookingLimiterKey = Symbol.for(
  "vista-valle.public-booking-rate-limiter"
);

/**
 * By decision (see openspec/changes/configure-production-supabase), reuses
 * the same process-local limiter under `production` while the deployment
 * target is a single instance. Must be replaced with a shared adapter
 * before deploying behind multiple serverless instances - see
 * `createInMemoryRequestLimiter`.
 */
export function getPublicBookingRequestLimiter(): RequestLimiter | null {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: RequestLimiter | undefined;
  };
  return (scope[publicBookingLimiterKey] ??= createInMemoryRequestLimiter());
}

export type AdminLoginLimiterResult =
  | Readonly<{ allowed: true }>
  | Readonly<{ allowed: false; retryAfterSeconds: number }>;

export type AdminLoginRequestLimiter = Readonly<{
  /** Counted by client address alone - cheap enough to run before the
   * request body is even parsed, so a pure IP flood never reaches that far. */
  checkClient: (request: Request) => AdminLoginLimiterResult;
  /** Counted by the submitted email, once it's known - still runs before
   * the identity provider is contacted. */
  checkEmail: (email: string) => AdminLoginLimiterResult;
}>;

/**
 * Admin login is counted on two independent dimensions
 * (harden-admin-authentication, task 5.1): by client address, so a single
 * attacker can't exhaust the account by brute force, and by the submitted
 * email, so the same target account can't be hammered from many addresses
 * (e.g. a botnet). Split into two checks, not one combined call, because
 * task 5.2 requires the client check to run before the request body is
 * parsed at all, while the email is only known after parsing it.
 *
 * Process-local, like `createInMemoryRequestLimiter`: this deployment uses
 * Vercel's platform-level firewall rate limiting (configured on
 * `/api/admin/auth/login`, not in this repository) as the control that
 * actually holds across instances - see `src/infrastructure/auth/README.md`.
 * This limiter is a defense-in-depth layer that still helps within a single
 * instance and keeps the response shape (429 + Retry-After) consistent
 * regardless of which layer catches a given burst.
 */
export function getAdminLoginRequestLimiter(
  now: () => number = Date.now
): AdminLoginRequestLimiter {
  const byClient = createKeyedCounter(8, 5 * 60_000, now);
  const byEmail = createKeyedCounter(10, 15 * 60_000, now);

  return Object.freeze({
    checkClient: (request) => Object.freeze(byClient.hit(clientKey(request))),
    checkEmail: (email) =>
      Object.freeze(byEmail.hit(email.trim().toLowerCase() || "unknown")),
  });
}

const adminLoginLimiterKey = Symbol.for(
  "vista-valle.admin-login-rate-limiter"
);

/** Process-wide singleton, so repeated calls across requests share state. */
export function getSharedAdminLoginRequestLimiter(): AdminLoginRequestLimiter {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: AdminLoginRequestLimiter | undefined;
  };
  return (scope[adminLoginLimiterKey] ??= getAdminLoginRequestLimiter());
}
