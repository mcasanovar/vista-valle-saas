import { describe, expect, it } from "vitest";
import { validateGuestForm } from "@/features/reservations";

describe("guest form validation boundary", () => {
  it("normalizes required and optional guest values", () => {
    const result = validateGuestForm({
      firstName: " Ana ",
      lastName: " Pérez ",
      email: "ana@example.com",
      phone: "+56 9 1111 1111",
      guestCount: "2",
      rut: " ",
      company: " Empresa ",
    });
    expect(result).toMatchObject({
      ok: true,
      value: { firstName: "Ana", company: "Empresa", guestCount: 2 },
    });
  });
  it("returns accessible field issues instead of a raw schema error", () => {
    const result = validateGuestForm({ guestCount: 0 });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok)
      expect(
        result.issues.find((issue) => issue.field === "email")?.message
      ).toBe("Este campo es obligatorio.");
  });
});
