import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  createDatabaseBoundary: vi.fn(),
  createProductionDatabase: vi.fn(() => ({})),
  createDrizzleReservationRepository: vi.fn(() => ({})),
  createDrizzleRoomLockGateway: vi.fn(() => ({})),
  queryProductionRooms: vi.fn(async () => []),
  editReservationDates: vi.fn(),
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
  const actual = await importOriginal<typeof import("@/features/reservations")>();
  return { ...actual, editReservationDates: mocks.editReservationDates };
});

import { editAdminReservationDatesAction } from "@/features/admin/edit-reservation-dates-action";
import { ReservationNotFoundError } from "@/features/reservations";
import {
  InvalidLodgingIntervalError,
  RoomLockConflictError,
} from "@/features/availability";

function formData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("edit admin reservation dates action", () => {
  it("requires an authenticated administrator before doing anything else", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(
      editAdminReservationDatesAction(
        formData({ id: "r1", checkIn: "2030-01-01", checkOut: "2030-01-03" })
      )
    ).rejects.toThrow();
    expect(mocks.editReservationDates).not.toHaveBeenCalled();
  });

  it("rejects a request missing required fields without touching the database", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    const result = await editAdminReservationDatesAction(
      formData({ id: "", checkIn: "", checkOut: "" })
    );
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(mocks.createDatabaseBoundary).not.toHaveBeenCalled();
  });

  it("refuses outside production", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createDatabaseBoundary.mockReturnValue({ context: "mock" });
    const result = await editAdminReservationDatesAction(
      formData({ id: "r1", checkIn: "2030-01-01", checkOut: "2030-01-03" })
    );
    expect(result).toMatchObject({ ok: false, code: "failure" });
    expect(mocks.editReservationDates).not.toHaveBeenCalled();
  });

  it("maps an invalid interval error to a validation result", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createDatabaseBoundary.mockReturnValue({ context: "production" });
    mocks.editReservationDates.mockRejectedValueOnce(
      new InvalidLodgingIntervalError("2030-01-03", "2030-01-01")
    );
    const result = await editAdminReservationDatesAction(
      formData({ id: "r1", checkIn: "2030-01-03", checkOut: "2030-01-01" })
    );
    expect(result).toMatchObject({ ok: false, code: "validation" });
  });

  it("maps a room-lock conflict to a conflict result", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createDatabaseBoundary.mockReturnValue({ context: "production" });
    mocks.editReservationDates.mockRejectedValueOnce(
      new RoomLockConflictError([], "room-1")
    );
    const result = await editAdminReservationDatesAction(
      formData({ id: "r1", checkIn: "2030-01-01", checkOut: "2030-01-05" })
    );
    expect(result).toMatchObject({ ok: false, code: "conflict" });
  });

  it("maps a not-found reservation to a failure result", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createDatabaseBoundary.mockReturnValue({ context: "production" });
    mocks.editReservationDates.mockRejectedValueOnce(
      new ReservationNotFoundError("r1")
    );
    const result = await editAdminReservationDatesAction(
      formData({ id: "r1", checkIn: "2030-01-01", checkOut: "2030-01-05" })
    );
    expect(result).toMatchObject({ ok: false, code: "failure" });
  });

  it("succeeds and revalidates the relevant admin paths", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createDatabaseBoundary.mockReturnValue({ context: "production" });
    mocks.editReservationDates.mockResolvedValueOnce({});
    const result = await editAdminReservationDatesAction(
      formData({ id: "r1", checkIn: "2030-01-01", checkOut: "2030-01-05" })
    );
    expect(result).toEqual({ ok: true });
    expect(mocks.editReservationDates).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          actorUserId: "admin-1",
          checkIn: "2030-01-01",
          checkOut: "2030-01-05",
          reservationId: "r1",
        }),
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/reservas");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/reservas/r1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/calendario");
  });
});
