export class InvalidBookingIdempotencyKeyError extends Error {
  readonly code = "INVALID_BOOKING_IDEMPOTENCY_KEY" as const;
}

export class ReusedBookingIdempotencyKeyError extends Error {
  readonly code = "REUSED_BOOKING_IDEMPOTENCY_KEY" as const;
}

export type BookingIdempotencyStore<TResult> = Readonly<{
  execute: (
    key: string,
    fingerprint: string,
    operation: () => Promise<TResult>
  ) => Promise<TResult>;
}>;

type Entry<TResult> = Readonly<{
  fingerprint: string;
  result: Promise<TResult>;
}>;

const IDEMPOTENCY_KEY_PATTERN =
  /^booking-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertBookingIdempotencyKey(key: string | null): string {
  if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new InvalidBookingIdempotencyKeyError("Invalid idempotency key");
  }
  return key;
}

/** The mock keeps in-flight and successful requests; failures release their key. */
export function createMockBookingIdempotencyStore<
  TResult,
>(): BookingIdempotencyStore<TResult> {
  const entries = new Map<string, Entry<TResult>>();

  return Object.freeze({
    execute: (key, fingerprint, operation) => {
      const existing = entries.get(key);
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new ReusedBookingIdempotencyKeyError(
            "Idempotency key was reused with different booking data"
          );
        }
        return existing.result;
      }

      const result = operation();
      const entry = Object.freeze({ fingerprint, result });
      entries.set(key, entry);
      void result.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      return result;
    },
  });
}
