import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  createDatabaseBoundary: vi.fn(),
  createProductionDatabase: vi.fn(() => ({})),
  createDrizzleReservationRepository: vi.fn(() => ({})),
  editReservationInvoice: vi.fn(),
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
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/reservations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/reservations")>();
  return { ...actual, editReservationInvoice: mocks.editReservationInvoice };
});

import { editReservationInvoiceAction } from "@/features/admin/edit-reservation-invoice-action";
import {
  InvalidInvoiceRequestInputError,
  ReservationNotFoundError,
} from "@/features/reservations";

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("edit reservation invoice action", () => {
  it("requires an authenticated administrator before doing anything else", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(
      editReservationInvoiceAction(
        formData({ reservationId: "r1", requested: "false" })
      )
    ).rejects.toThrow();
    expect(mocks.editReservationInvoice).not.toHaveBeenCalled();
  });

  it("rejects a request missing the reservation id without touching the database", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    const result = await editReservationInvoiceAction(
      formData({ reservationId: "", requested: "false" })
    );
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(mocks.createDatabaseBoundary).not.toHaveBeenCalled();
  });

  it("refuses outside production", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createDatabaseBoundary.mockReturnValue({ context: "mock" });
    const result = await editReservationInvoiceAction(
      formData({ reservationId: "r1", requested: "false" })
    );
    expect(result).toMatchObject({ ok: false, code: "failure" });
    expect(mocks.editReservationInvoice).not.toHaveBeenCalled();
  });

  it("maps an invalid invoice input error to a validation result", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createDatabaseBoundary.mockReturnValue({ context: "production" });
    mocks.editReservationInvoice.mockRejectedValueOnce(
      new InvalidInvoiceRequestInputError([
        { field: "rut", message: "El RUT no es válido." },
      ])
    );
    const result = await editReservationInvoiceAction(
      formData({ reservationId: "r1", requested: "true" })
    );
    expect(result).toMatchObject({ ok: false, code: "validation" });
  });

  it("maps a not-found reservation to a failure result", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createDatabaseBoundary.mockReturnValue({ context: "production" });
    mocks.editReservationInvoice.mockRejectedValueOnce(
      new ReservationNotFoundError("r1")
    );
    const result = await editReservationInvoiceAction(
      formData({ reservationId: "r1", requested: "false" })
    );
    expect(result).toMatchObject({ ok: false, code: "failure" });
  });

  it("succeeds removing an invoice request and revalidates the reservation page", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createDatabaseBoundary.mockReturnValue({ context: "production" });
    mocks.editReservationInvoice.mockResolvedValueOnce({});
    const result = await editReservationInvoiceAction(
      formData({ reservationId: "r1", requested: "false" })
    );
    expect(result).toEqual({ ok: true });
    expect(mocks.editReservationInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          actorUserId: "admin-1",
          requested: false,
          reservationId: "r1",
        }),
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/reservas/r1");
  });

  it("succeeds adding an invoice request with every field", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createDatabaseBoundary.mockReturnValue({ context: "production" });
    mocks.editReservationInvoice.mockResolvedValueOnce({});
    const result = await editReservationInvoiceAction(
      formData({
        businessActivity: "Comercio",
        email: "facturacion@example.com",
        name: "Empresa SpA",
        phone: "+56 9 1111 2222",
        requested: "true",
        reservationId: "r1",
        rut: "76086428-5",
      })
    );
    expect(result).toEqual({ ok: true });
    expect(mocks.editReservationInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          businessActivity: "Comercio",
          email: "facturacion@example.com",
          name: "Empresa SpA",
          phone: "+56 9 1111 2222",
          requested: true,
          rut: "76086428-5",
        }),
      })
    );
  });
});
