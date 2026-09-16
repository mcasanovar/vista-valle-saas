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

/**
 * Same allow-listing discipline as `publicBookingConfirmationCandidate` —
 * shared by every online-payment provider (Fintoc, Mercado Pago), since
 * the fields the online checkout flow accepts from the client are
 * identical regardless of which provider processes the payment.
 */
export function publicOnlineCheckoutCandidate(
  value: unknown
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    allowedFields.map((field) => [field, record[field]])
  );
}
