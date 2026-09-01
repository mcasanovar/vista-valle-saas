import "server-only";

import {
  redactObservabilityData,
  writeStructuredLog,
  type ObservabilityContext,
} from "./server";

export { writeStructuredLog } from "./server";

export type SentryCaptureHook = (
  error: unknown,
  context: Readonly<Record<string, unknown>>
) => void | Promise<void>;

let sentryCaptureHook: SentryCaptureHook | null = null;

/**
 * Connects an optional server-side Sentry adapter. The application deliberately
 * has no default network exporter: without an explicitly registered hook it
 * records a redacted structured log only.
 */
export function registerSentryCaptureHook(hook: SentryCaptureHook | null) {
  sentryCaptureHook = hook;
}

export async function captureServerException(
  event: string,
  error: unknown,
  context: ObservabilityContext = {}
) {
  const safeContext = redactObservabilityData(context) as Readonly<
    Record<string, unknown>
  >;
  writeStructuredLog("error", event, { ...safeContext, error });

  if (
    process.env.VISTA_VALLE_CONFIG_CONTEXT !== "production" ||
    !process.env.SENTRY_DSN ||
    !sentryCaptureHook
  ) {
    return false;
  }

  try {
    await sentryCaptureHook(redactObservabilityData(error), safeContext);
    return true;
  } catch {
    // Monitoring must not change booking or payment outcomes.
    return false;
  }
}
