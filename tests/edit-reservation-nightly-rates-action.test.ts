import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  createDatabaseBoundary: vi.fn(),
  createProductionDatabase: vi.fn(() => ({})),
  createDrizzleReservationRepository: vi.fn(() => ({})),
  createDrizzleRoomLockGateway: vi.fn(() => ({})),
  queryProductionRooms: vi.fn(async () => []),
  editReservationNightlyRates: vi.fn(),
  editReservationOrigin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("@/infrastructure/database/server", () => ({
  createDatabaseBoundary: mocks.createDatabaseBoundary,
}));
vi.mock("@/infrastructure/database/client", () => ({
  createProductionDatabase: mocks.createProductionDatabase,
}));
vi.mock("@/infrastructure/database/reservation-repository", () => ({
  createDrizzleReservationRepository: mocks.createDrizzleReservationRepository,
}));
vi.mock("@/infrastructure/database/room-lock", () => ({
  createDrizzleRoomLockGateway: mocks.createDrizzleRoomLockGateway,
}));
vi.mock("@/infrastructure/database/room-source", () => ({
  queryProductionRooms: mocks.queryProductionRooms,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/reservations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/reservations")>();
  return {
    ...actual,
    editReservationOrigin: mocks.editReservationOrigin,
    editReservationNightlyRates: mocks.editReservationNightlyRates,
  };
});

import { editAdminReservationNightlyRatesAction } from "@/features/admin/edit-reservation-nightly-rates-action";
import {
  parseNightlyRateAmount,
  parseNightlyRateOverrides,
} from "@/features/admin/nightly-rate-amount";
import { editAdminReservationOriginAction } from "@/features/admin/edit-reservation-origin-action";
import {
  InvalidNightlyRateError,
  ReservationNotExternalChannelError,
} from "@/features/reservations";

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => vi.clearAllMocks());

function asAdministrator() {
  mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
  mocks.createDatabaseBoundary.mockReturnValue({ context: "production" });
}

describe("parseNightlyRateOverrides (task 6.1)", () => {
  it("reads one override per rate field and treats an empty value as a drop", () => {
    const data = formData({
      "rate:room-1": "42000",
      "rate:room-2": "",
      id: "reservation-1",
    });

    expect(parseNightlyRateOverrides(data)).toEqual([
      { nightlyPriceClp: 42_000, roomId: "room-1" },
      { nightlyPriceClp: null, roomId: "room-2" },
    ]);
  });

  it("reads a Chilean-formatted amount as whole pesos", () => {
    expect(
      parseNightlyRateOverrides(formData({ "rate:room-1": "$ 42.000" }))
    ).toEqual([{ nightlyPriceClp: 42_000, roomId: "room-1" }]);
    expect(
      parseNightlyRateOverrides(formData({ "rate:room-1": "1.234.567" }))
    ).toEqual([{ nightlyPriceClp: 1_234_567, roomId: "room-1" }]);
  });

  it.each(["42,5", "4.2", "abc", "42.00", "1.2345"])(
    "passes the malformed amount %p through as NaN so the domain rejects it",
    (raw) => {
      const [override] = parseNightlyRateOverrides(
        formData({ "rate:room-1": raw })
      );
      expect(override?.nightlyPriceClp).toBeNaN();
    }
  );

  it("ignores every field that is not a rate", () => {
    const data = formData({
      id: "reservation-1",
      subtotalClp: "999",
      totalClp: "999",
    });
    expect(parseNightlyRateOverrides(data)).toEqual([]);
  });
});

describe("parseNightlyRateAmount", () => {
  it.each([
    ["42000", 42_000],
    ["42.000", 42_000],
    ["$42.000", 42_000],
    ["$ 42.000", 42_000],
    ["1.234.567", 1_234_567],
    ["1", 1],
  ])("reads %p as %i", (raw, expected) => {
    expect(parseNightlyRateAmount(raw)).toBe(expected);
  });

  it.each(["", "42,5", "4.2", "42.00", "abc", "-42000"])(
    "returns NaN for %p",
    (raw) => {
      expect(parseNightlyRateAmount(raw)).toBeNaN();
    }
  );
});

describe("editAdminReservationNightlyRatesAction (task 6.1)", () => {
  it("requires an administrator session before doing anything", async () => {
    mocks.requireAdministrator.mockRejectedValue(new Error("unauthorized"));

    await expect(
      editAdminReservationNightlyRatesAction(
        formData({ "rate:room-1": "42000", id: "reservation-1" })
      )
    ).rejects.toThrow("unauthorized");
    expect(mocks.editReservationNightlyRates).not.toHaveBeenCalled();
  });

  it("passes the parsed overrides and the session actor to the domain", async () => {
    asAdministrator();
    mocks.editReservationNightlyRates.mockResolvedValue({
      financialSummary: {
        approvedPaymentsClp: 0,
        overpaymentClp: 0,
        paymentAction: { amountClp: 126_000, type: "set_pending" },
        pendingBalanceClp: 126_000,
      },
      reservation: { totalClp: 126_000 },
    });

    const result = await editAdminReservationNightlyRatesAction(
      formData({ "rate:room-1": "42000", id: "reservation-1" })
    );

    expect(result).toEqual({
      financialSummary: {
        overpaymentClp: 0,
        pendingBalanceClp: 126_000,
        totalClp: 126_000,
      },
      ok: true,
    });
    expect(mocks.editReservationNightlyRates).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          actorUserId: "admin-1",
          overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
          reservationId: "reservation-1",
        },
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/admin/reservas/reservation-1"
    );
  });

  it("reports an invalid amount as a validation result instead of throwing", async () => {
    asAdministrator();
    mocks.editReservationNightlyRates.mockRejectedValue(
      new InvalidNightlyRateError("room-1", 0)
    );

    const result = await editAdminReservationNightlyRatesAction(
      formData({ "rate:room-1": "0", id: "reservation-1" })
    );

    expect(result).toEqual({
      code: "validation",
      message: "El valor por noche debe ser un monto entero mayor que cero.",
      ok: false,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports an ineligible origin as a validation result", async () => {
    asAdministrator();
    mocks.editReservationNightlyRates.mockRejectedValue(
      new ReservationNotExternalChannelError("website")
    );

    const result = await editAdminReservationNightlyRatesAction(
      formData({ "rate:room-1": "42000", id: "reservation-1" })
    );

    expect(result).toMatchObject({ code: "validation", ok: false });
  });

  it("rejects a submission with no rate field at all", async () => {
    asAdministrator();

    const result = await editAdminReservationNightlyRatesAction(
      formData({ id: "reservation-1" })
    );

    expect(result).toEqual({
      code: "validation",
      message: "Indica al menos un valor por noche para actualizar.",
      ok: false,
    });
    expect(mocks.editReservationNightlyRates).not.toHaveBeenCalled();
  });
});

describe("editAdminReservationOriginAction (task 6.2)", () => {
  it("requires an administrator session", async () => {
    mocks.requireAdministrator.mockRejectedValue(new Error("unauthorized"));

    await expect(
      editAdminReservationOriginAction(
        formData({ id: "reservation-1", origin: "booking" })
      )
    ).rejects.toThrow("unauthorized");
    expect(mocks.editReservationOrigin).not.toHaveBeenCalled();
  });

  it("corrects the origin and revalidates the detail", async () => {
    asAdministrator();
    mocks.editReservationOrigin.mockResolvedValue({
      reservation: { totalClp: 150_000 },
    });

    const result = await editAdminReservationOriginAction(
      formData({ id: "reservation-1", origin: "booking" })
    );

    expect(result).toEqual({ ok: true });
    expect(mocks.editReservationOrigin).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          actorUserId: "admin-1",
          origin: "booking",
          reservationId: "reservation-1",
        },
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/admin/reservas/reservation-1"
    );
  });

  it.each(["website", "phone", "whatsapp", "admin", "airbnb", "booking"])(
    "accepts %p as a target origin",
    async (origin) => {
      asAdministrator();
      mocks.editReservationOrigin.mockResolvedValue({
        reservation: { totalClp: 150_000 },
      });

      const result = await editAdminReservationOriginAction(
        formData({ id: "reservation-1", origin })
      );

      expect(result).toEqual({ ok: true });
      expect(mocks.editReservationOrigin).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ origin }),
        })
      );
    }
  );

  it.each(["", "Booking", "hotel", "expedia"])(
    "rejects %p before reaching the domain",
    async (origin) => {
      asAdministrator();

      const result = await editAdminReservationOriginAction(
        formData({ id: "reservation-1", origin })
      );

      expect(result).toEqual({
        code: "validation",
        message: "Selecciona un origen válido para la reserva.",
        ok: false,
      });
      expect(mocks.editReservationOrigin).not.toHaveBeenCalled();
    }
  );

  it("reports the reprice when the correction dropped a hand-set value", async () => {
    asAdministrator();
    mocks.editReservationOrigin.mockResolvedValue({
      financialSummary: {
        approvedPaymentsClp: 0,
        overpaymentClp: 0,
        paymentAction: { amountClp: 180_000, type: "set_pending" },
        pendingBalanceClp: 180_000,
      },
      reservation: { totalClp: 180_000 },
    });

    const result = await editAdminReservationOriginAction(
      formData({ id: "reservation-1", origin: "admin" })
    );

    expect(result).toEqual({
      financialSummary: {
        overpaymentClp: 0,
        pendingBalanceClp: 180_000,
        totalClp: 180_000,
      },
      ok: true,
    });
  });
});

describe("neither action trusts a client-supplied total (task 6.3)", () => {
  it("ignores subtotal and total fields present in the submission", async () => {
    asAdministrator();
    mocks.editReservationNightlyRates.mockResolvedValue({
      financialSummary: {
        approvedPaymentsClp: 0,
        overpaymentClp: 0,
        paymentAction: { type: "none" },
        pendingBalanceClp: 0,
      },
      reservation: { totalClp: 126_000 },
    });

    await editAdminReservationNightlyRatesAction(
      formData({
        "rate:room-1": "42000",
        chargesClp: "777",
        id: "reservation-1",
        subtotalClp: "1",
        totalClp: "1",
      })
    );

    const call = mocks.editReservationNightlyRates.mock.calls[0]![0] as {
      input: Record<string, unknown>;
    };
    // The use case receives only the ids and the per-room nightly values.
    expect(Object.keys(call.input).sort()).toEqual([
      "actorUserId",
      "overrides",
      "reservationId",
    ]);
    expect(call.input.overrides).toEqual([
      { nightlyPriceClp: 42_000, roomId: "room-1" },
    ]);
  });

  it("sends only the id and the origin for an origin correction", async () => {
    asAdministrator();
    mocks.editReservationOrigin.mockResolvedValue({
      reservation: { totalClp: 150_000 },
    });

    await editAdminReservationOriginAction(
      formData({ id: "reservation-1", origin: "booking", totalClp: "1" })
    );

    const call = mocks.editReservationOrigin.mock.calls[0]![0] as {
      input: Record<string, unknown>;
    };
    expect(Object.keys(call.input).sort()).toEqual([
      "actorUserId",
      "origin",
      "reservationId",
    ]);
  });
});
