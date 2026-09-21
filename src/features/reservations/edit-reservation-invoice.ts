import {
  ReservationNotFoundError,
  type InvoiceRequest,
  type ReservationRepository,
} from "./reservation-repository";

export type InvoiceRequestEditCandidate = Readonly<{
  requested: boolean;
  businessActivity?: string;
  email?: string;
  name?: string;
  phone?: string;
  rut?: string;
}>;

export type InvoiceRequestValidationIssue = Readonly<{
  field: string;
  message: string;
}>;

export class InvalidInvoiceRequestInputError extends Error {
  readonly code = "INVALID_INVOICE_REQUEST_INPUT" as const;
  readonly issues: readonly InvoiceRequestValidationIssue[];

  constructor(issues: readonly InvoiceRequestValidationIssue[]) {
    super(
      `Datos de facturación no válidos: ${issues
        .map((issue) => `${issue.field} (${issue.message})`)
        .join("; ")}`
    );
    this.name = "InvalidInvoiceRequestInputError";
    this.issues = issues;
  }
}

const isValidEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

/** Full modulo-11 Chilean RUT checksum, mirroring `normalizeInvoiceRequest` (`./create-pay-at-property-reservation.ts`). */
function isValidChileanRut(rut: string) {
  const compact = rut.replace(/[^0-9kK]/g, "").toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(compact)) return false;
  const body = compact.slice(0, -1);
  const verifier = compact.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (const digit of [...body].reverse()) {
    sum += Number(digit) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expected = String(11 - (sum % 11)).replace("10", "K").replace("11", "0");
  return verifier === expected;
}

/**
 * Validates an admin-submitted invoice edit. `requested: false` always
 * clears the request, regardless of what the other fields hold. `requested:
 * true` requires every field non-empty and valid, mirroring the DB check
 * `reservations_invoice_request_complete` (`src/persistence/schema.ts`),
 * which forbids a partially-filled invoice request.
 */
export function parseInvoiceRequestEditInput(
  candidate: InvoiceRequestEditCandidate
): InvoiceRequest | null {
  if (!candidate.requested) return null;

  const fields = {
    businessActivity: candidate.businessActivity?.trim() ?? "",
    email: candidate.email?.trim() ?? "",
    name: candidate.name?.trim() ?? "",
    phone: candidate.phone?.trim() ?? "",
    rut: candidate.rut?.trim() ?? "",
  };

  const issues: InvoiceRequestValidationIssue[] = [];
  if (!fields.name)
    issues.push({ field: "name", message: "Indica la razón social." });
  if (!fields.rut) issues.push({ field: "rut", message: "Indica el RUT." });
  else if (!isValidChileanRut(fields.rut))
    issues.push({ field: "rut", message: "El RUT no es válido." });
  if (!fields.phone)
    issues.push({ field: "phone", message: "Indica un teléfono." });
  if (!fields.businessActivity)
    issues.push({ field: "businessActivity", message: "Indica el giro." });
  if (!fields.email)
    issues.push({ field: "email", message: "Indica un correo." });
  else if (!isValidEmail(fields.email))
    issues.push({
      field: "email",
      message: "Ingresa un correo electrónico válido.",
    });

  if (issues.length) throw new InvalidInvoiceRequestInputError(issues);

  return Object.freeze(fields);
}

export type EditReservationInvoiceInput = InvoiceRequestEditCandidate &
  Readonly<{ actorUserId?: string; reservationId: string }>;

export type EditReservationInvoiceParams<TContext> = Readonly<{
  input: EditReservationInvoiceInput;
  reservationRepository: ReservationRepository<TContext>;
}>;

/**
 * Adds, edits, or removes a reservation's invoice request, independent of
 * its origin or status - same reasoning as `editReservationGuestContact`
 * (design.md decision 4 of "allow-full-reservation-editing-and-ota-sync-toggle"):
 * billing details are corrected separately from dates, guest contact, and
 * status, with no room lock or financial recalculation involved.
 */
export async function editReservationInvoice<TContext>(
  params: EditReservationInvoiceParams<TContext>
) {
  const { input, reservationRepository } = params;
  const invoiceRequest = parseInvoiceRequestEditInput(input);

  const reservation = await reservationRepository.getReservationById(
    input.reservationId
  );
  if (!reservation) throw new ReservationNotFoundError(input.reservationId);

  if (!reservationRepository.updateInvoiceRequest) {
    throw new Error(
      "This reservation repository does not support invoice edits"
    );
  }

  return reservationRepository.updateInvoiceRequest(
    input.reservationId,
    invoiceRequest,
    input.actorUserId
  );
}
