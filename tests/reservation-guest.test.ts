import { describe, expect, it } from "vitest";

import {
  InvalidGuestInputError,
  parseGuestInput,
} from "@/features/reservations";

const validGuest = Object.freeze({
  email: "ana@example.com",
  firstName: "Ana",
  guestCount: 2,
  lastName: "Perez",
  phone: "+56 9 1234 5678",
});

describe("guest booking input validation", () => {
  it("accepts a fully valid input without optional fields", () => {
    const guest = parseGuestInput(validGuest);

    expect(guest).toEqual({
      email: "ana@example.com",
      firstName: "Ana",
      guestCount: 2,
      lastName: "Perez",
      phone: "+56 9 1234 5678",
    });
    expect(Object.isFrozen(guest)).toBe(true);
  });

  it("accepts a fully valid input with optional fields, trimmed", () => {
    const guest = parseGuestInput({
      ...validGuest,
      comment: "  Llegada tarde  ",
      company: "  Vista Valle SpA  ",
      rut: "  12.345.678-9  ",
    });

    expect(guest.comment).toBe("Llegada tarde");
    expect(guest.company).toBe("Vista Valle SpA");
    expect(guest.rut).toBe("12.345.678-9");
  });

  it("treats blank optional fields as absent instead of invalid", () => {
    const guest = parseGuestInput({
      ...validGuest,
      comment: "   ",
      company: "",
      rut: "   ",
    });

    expect(guest.comment).toBeUndefined();
    expect(guest.company).toBeUndefined();
    expect(guest.rut).toBeUndefined();
  });

  it("rejects a missing required field with a domain error", () => {
    const { firstName, ...withoutFirstName } = validGuest;
    void firstName;

    expect(() => parseGuestInput(withoutFirstName)).toThrow(
      InvalidGuestInputError
    );

    try {
      parseGuestInput(withoutFirstName);
      throw new Error("expected parseGuestInput to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidGuestInputError);
      const guestError = error as InvalidGuestInputError;
      expect(guestError.code).toBe("INVALID_GUEST_INPUT");
      expect(
        guestError.issues.find((issue) => issue.field === "firstName")?.message
      ).toBe("Este campo es obligatorio.");
    }
  });

  it("rejects an invalid email with a domain error", () => {
    expect(() =>
      parseGuestInput({ ...validGuest, email: "not-an-email" })
    ).toThrow(InvalidGuestInputError);

    try {
      parseGuestInput({ ...validGuest, email: "not-an-email" });
      throw new Error("expected parseGuestInput to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidGuestInputError);
      expect(
        (error as InvalidGuestInputError).issues.find(
          (issue) => issue.field === "email"
        )?.message
      ).toBe("Ingresa un correo electrónico válido.");
    }
  });

  it("rejects a non-positive guestCount with a domain error", () => {
    expect(() => parseGuestInput({ ...validGuest, guestCount: 0 })).toThrow(
      InvalidGuestInputError
    );
    expect(() => parseGuestInput({ ...validGuest, guestCount: -1 })).toThrow(
      InvalidGuestInputError
    );
    expect(() => parseGuestInput({ ...validGuest, guestCount: 1.5 })).toThrow(
      InvalidGuestInputError
    );
  });

  it("never leaks a raw ZodError", () => {
    try {
      parseGuestInput({});
      throw new Error("expected parseGuestInput to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidGuestInputError);
      expect((error as { name?: string }).name).not.toBe("ZodError");
    }
  });
});
