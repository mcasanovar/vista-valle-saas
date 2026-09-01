import { z } from "zod";

/**
 * Contact details that are persisted on the `guests` table. Kept separate
 * from booking-only fields (`guestCount`, `comment`) so future persistence
 * code can map this shape directly onto `guests` without guessing which
 * fields belong where.
 */
export type GuestContactDetails = Readonly<{
  company?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  rut?: string;
}>;

/**
 * Everything a booking flow collects from the guest. `guestCount` and
 * `comment` are reservation-level fields (see `reservations.guest_comment`
 * in `src/persistence/schema.ts`); they are not stored on `guests`.
 */
export type GuestBookingInput = Readonly<
  GuestContactDetails & {
    comment?: string;
    guestCount: number;
  }
>;

export type GuestValidationIssue = Readonly<{
  field: string;
  message: string;
}>;

export class InvalidGuestInputError extends Error {
  readonly code = "INVALID_GUEST_INPUT" as const;
  readonly issues: readonly GuestValidationIssue[];

  constructor(issues: readonly GuestValidationIssue[]) {
    super(
      `Datos de huésped no válidos: ${issues
        .map((issue) => `${issue.field} (${issue.message})`)
        .join("; ")}`
    );
    this.name = "InvalidGuestInputError";
    this.issues = issues;
  }
}

function requiredTrimmed(maxLength: number) {
  return z
    .string({ error: "Este campo es obligatorio." })
    .trim()
    .min(1, { error: "Este campo es obligatorio." })
    .max(maxLength, { error: "El valor ingresado es demasiado extenso." });
}

function optionalTrimmed(maxLength?: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    typeof maxLength === "number"
      ? z
          .string()
          .min(1, { error: "Este campo es obligatorio." })
          .max(maxLength, {
            error: "El valor ingresado es demasiado extenso.",
          })
          .optional()
      : z.string().min(1, { error: "Este campo es obligatorio." }).optional()
  );
}

const isValidEmail = (value: string) => z.email().safeParse(value).success;

const guestBookingInputSchema = z.object({
  comment: optionalTrimmed(),
  company: optionalTrimmed(200),
  email: requiredTrimmed(320).refine(isValidEmail, {
    message: "Ingresa un correo electrónico válido.",
  }),
  firstName: requiredTrimmed(160),
  guestCount: z.coerce
    .number({ error: "Indica una cantidad válida de huéspedes." })
    .int({ error: "Indica una cantidad válida de huéspedes." })
    .positive({ error: "Indica una cantidad válida de huéspedes." })
    .default(1),
  lastName: requiredTrimmed(160),
  phone: requiredTrimmed(80),
  rut: optionalTrimmed(32),
});

export type GuestBookingInputCandidate = z.input<
  typeof guestBookingInputSchema
>;

function describeIssue(issue: z.core.$ZodIssue): GuestValidationIssue {
  return {
    field: issue.path.join(".") || "guest",
    message: issue.message,
  };
}

/**
 * Validates and normalizes raw guest booking input. Never trusts the
 * caller: unknown input is parsed defensively and a stable domain error is
 * thrown (never a raw `ZodError`) so callers can render or log a consistent
 * contract.
 */
export function parseGuestInput(candidate: unknown): GuestBookingInput {
  const parsed = guestBookingInputSchema.safeParse(candidate);

  if (!parsed.success) {
    throw new InvalidGuestInputError(parsed.error.issues.map(describeIssue));
  }

  return Object.freeze({ ...parsed.data });
}
