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
  /(?:address|authorization|comment|cookie|email|firstName|lastName|name|password|phone|rut|secret|token|apiKey|accessKey|webhook)/i;

function isSensitiveKey(key: string) {
  return sensitiveKey.test(key.replace(/[^a-z0-9]/gi, ""));
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
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
