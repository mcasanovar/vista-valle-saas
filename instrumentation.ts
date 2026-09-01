import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./src/infrastructure/observability/sentry");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { captureServerException } =
    await import("./src/infrastructure/observability/sentry");
  const pathname = request.path.split("?", 1)[0];
  await captureServerException("next.request_error", error, {
    method: request.method,
    pathname,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
