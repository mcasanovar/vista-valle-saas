import "server-only";

export type ObservabilityContext = Readonly<{
  paymentId?: string;
  reservationId?: string;
  [key: string]: unknown;
}>;

export type StructuredLogRecord = Readonly<{
  context: Readonly<Record<string, unknown>>;
  event: string;
  level: "error" | "info" | "warn";
  timestamp: string;
}>;

type LogSink = (record: StructuredLogRecord) => void;

const redactedValue = "[REDACTED]";
const sensitiveKey =
  /(?:address|authorization|bearer|credential|connectionstring|databaseurl|dsn|comment|cookie|email|firstName|lastName|name|password|phone|rut|secret|signature|token|apiKey|accessKey|url|href|webhook)/i;

function isSensitiveKey(key: string) {
  return sensitiveKey.test(key.replace(/[^a-z0-9]/gi, ""));
}

/**
 * JWT-shaped string, a `Bearer <token>` header value, or a PostgreSQL
 * connection string with embedded credentials (harden-admin-authentication,
 * task 13.4) — redacted regardless of the key it's found under, because a
 * value this shaped is a credential by construction, not by naming
 * convention: `isSensitiveKey` alone misses it under an unrecognized key
 * (e.g. inside an array, or a key not yet added to the alternation above).
 */
const jwtShape = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const bearerShape = /^Bearer\s+\S+$/i;
const postgresConnectionStringShape = /^postgres(?:ql)?:\/\/[^:/@\s]+:[^@\s]+@/i;

function isCredentialShapedString(value: string): boolean {
  return (
    jwtShape.test(value) ||
    bearerShape.test(value) ||
    postgresConnectionStringShape.test(value)
  );
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string" && isCredentialShapedString(value)) {
    return redactedValue;
  }
  if (value instanceof Error) {
    const candidate = value as Error & { code?: unknown };
    return Object.freeze({
      code: typeof candidate.code === "string" ? candidate.code : undefined,
      name: value.name,
    });
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[CIRCULAR]";

  seen.add(value);
  const safe = Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      isSensitiveKey(key) ? redactedValue : redactValue(nested, seen),
    ])
  );
  seen.delete(value);
  return Object.freeze(safe);
}

/** Removes PII and provider credentials from arbitrary observability metadata. */
export function redactObservabilityData(value: unknown) {
  return redactValue(value, new WeakSet<object>());
}

let logSink: LogSink = (record) => {
  console.log(JSON.stringify(record));
};

export function setStructuredLogSinkForTests(sink: LogSink | null) {
  logSink = sink ?? ((record) => console.log(JSON.stringify(record)));
}

export function writeStructuredLog(
  level: StructuredLogRecord["level"],
  event: string,
  context: ObservabilityContext = {}
) {
  const record: StructuredLogRecord = Object.freeze({
    context: redactObservabilityData(context) as Readonly<
      Record<string, unknown>
    >,
    event,
    level,
    timestamp: new Date().toISOString(),
  });
  logSink(record);
  return record;
}
