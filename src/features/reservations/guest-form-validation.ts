import {
  InvalidGuestInputError,
  parseGuestInput,
  type GuestBookingInput,
} from "./guest";

export type GuestFormValidation =
  | Readonly<{ ok: true; value: GuestBookingInput }>
  | Readonly<{
      ok: false;
      issues: readonly { field: string; message: string }[];
    }>;

/** Reusable authoritative boundary for the later booking command. */
export function validateGuestForm(candidate: unknown): GuestFormValidation {
  try {
    return { ok: true, value: parseGuestInput(candidate) };
  } catch (error) {
    if (error instanceof InvalidGuestInputError)
      return { ok: false, issues: error.issues };
    throw error;
  }
}
