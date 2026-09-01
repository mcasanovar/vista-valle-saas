export class PublicApiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicApiResponseError";
  }
}

export function publicApiResponseError(
  body: unknown,
  fallback: string
): PublicApiResponseError {
  const message =
    body &&
    typeof body === "object" &&
    typeof (body as { message?: unknown }).message === "string"
      ? (body as { message: string }).message.trim()
      : "";
  return new PublicApiResponseError(message || fallback);
}

export function safePublicErrorMessage(cause: unknown, fallback: string) {
  return cause instanceof PublicApiResponseError ? cause.message : fallback;
}
