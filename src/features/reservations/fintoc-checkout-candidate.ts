const allowedFields = [
  "room",
  "rooms",
  "checkIn",
  "checkOut",
  "firstName",
  "lastName",
  "email",
  "phone",
  "comment",
] as const;

/** Same allow-listing discipline as `publicBookingConfirmationCandidate` — only the online-payment flow's single-room fields. */
export function publicFintocCheckoutCandidate(
  value: unknown
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    allowedFields.map((field) => [field, record[field]])
  );
}
