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
  "invoiceRequested",
  "invoiceName",
  "invoiceRut",
  "invoicePhone",
  "invoiceBusinessActivity",
  "invoiceEmail",
] as const;

export function publicBookingConfirmationCandidate(
  value: unknown
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    allowedFields.map((field) => [field, record[field]])
  );
}

/** Stable server-side fingerprint over only input accepted by the command. */
export function bookingConfirmationFingerprint(
  candidate: Record<string, unknown>
) {
  return JSON.stringify(
    allowedFields.map((field) => [field, candidate[field] ?? null])
  );
}
