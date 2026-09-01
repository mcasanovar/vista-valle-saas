import "server-only";

export type RequestLimiter = Readonly<{
  consume: (
    request: Request
  ) =>
    | Readonly<{ allowed: true }>
    | Readonly<{ allowed: false; retryAfterSeconds: number }>;
}>;

function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anonymous"
  );
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
  const entries = new Map<string, { count: number; resetAt: number }>();

  return Object.freeze({
    consume(request) {
      const key = clientKey(request);
      const time = now();
      const current = entries.get(key);
      const entry =
        !current || current.resetAt <= time
          ? { count: 0, resetAt: time + windowMs }
          : current;

      entry.count += 1;
      entries.set(key, entry);
      if (entry.count <= limit)
        return Object.freeze({ allowed: true as const });
      return Object.freeze({
        allowed: false as const,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((entry.resetAt - time) / 1000)
        ),
      });
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
