import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  createDatabaseBoundary: vi.fn(),
  createProductionDatabase: vi.fn(() => ({})),
  createDrizzleReservationRepository: vi.fn(() => ({})),
  createDrizzleRoomLockGateway: vi.fn(() => ({})),
  createDrizzleNotificationOutboxWriter: vi.fn(() => ({})),
  queryProductionRooms: vi.fn(async () => []),
  editReservationStay: vi.fn(),
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
vi.mock("@/infrastructure/database/notification-outbox-repository", () => ({
  createDrizzleNotificationOutboxWriter:
    mocks.createDrizzleNotificationOutboxWriter,
}));
vi.mock("@/infrastructure/database/room-source", () => ({
  queryProductionRooms: mocks.queryProductionRooms,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/reservations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/reservations")>();
  return { ...actual, editReservationStay: mocks.editReservationStay };
});

import { editAdminReservationStayAction } from "@/features/admin/edit-reservation-stay-action";
import {
  ReservationStayRequiresRoomError,
  ReservationStayRoomCapacityExceededError,
} from "@/features/reservations";
import { RoomLockConflictError } from "@/features/availability";

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

describe("edit admin reservation stay action (task 5.1)", () => {
  it("requires an authenticated administrator before doing anything else", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));

    await expect(
      editAdminReservationStayAction(formData({ id: "r1", rooms: "room-a:2" }))
    ).rejects.toThrow();
    expect(mocks.editReservationStay).not.toHaveBeenCalled();
  });

  it("sends dates, rooms and occupancy together in one call", async () => {
    asAdministrator();
    mocks.editReservationStay.mockResolvedValueOnce({});

    const result = await editAdminReservationStayAction(
      formData({
        checkIn: "2030-01-01",
        checkOut: "2030-01-05",
        id: "r1",
        rooms: "room-a:2,room-b:3",
      })
    );

    expect(result).toEqual({ ok: true });
    expect(mocks.editReservationStay).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          actorUserId: "admin-1",
          checkIn: "2030-01-01",
          checkOut: "2030-01-05",
          items: [
            { guestCount: 2, roomId: "room-a" },
            { guestCount: 3, roomId: "room-b" },
          ],
          reservationId: "r1",
        }),
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/reservas/r1");
  });

  it("omits the rooms axis when the form carries no rooms field", async () => {
    asAdministrator();
    mocks.editReservationStay.mockResolvedValueOnce({});

    await editAdminReservationStayAction(
      formData({ checkIn: "2030-02-01", checkOut: "2030-02-03", id: "r2" })
    );

    const call = mocks.editReservationStay.mock.calls.at(-1)![0];
    expect(call.input.items).toBeUndefined();
    expect(call.input.checkIn).toBe("2030-02-01");
  });

  it("omits the dates axis when the form carries no dates", async () => {
    asAdministrator();
    mocks.editReservationStay.mockResolvedValueOnce({});

    await editAdminReservationStayAction(
      formData({ id: "r3", rooms: "room-a:4" })
    );

    const call = mocks.editReservationStay.mock.calls.at(-1)![0];
    expect(call.input.checkIn).toBeUndefined();
    expect(call.input.checkOut).toBeUndefined();
    expect(call.input.items).toEqual([{ guestCount: 4, roomId: "room-a" }]);
  });

  it("rejects a submission with one date but not the other", async () => {
    asAdministrator();

    const result = await editAdminReservationStayAction(
      formData({ checkIn: "2030-03-01", id: "r4", rooms: "room-a:2" })
    );

    expect(result).toMatchObject({ code: "validation", ok: false });
    expect(mocks.editReservationStay).not.toHaveBeenCalled();
  });

  it("rejects a submission whose rooms field is present but empty", async () => {
    asAdministrator();

    const result = await editAdminReservationStayAction(
      formData({ id: "r5", rooms: "" })
    );

    expect(result).toMatchObject({
      code: "validation",
      message: "La reserva debe conservar al menos una habitación.",
      ok: false,
    });
    expect(mocks.editReservationStay).not.toHaveBeenCalled();
  });

  it("never throws: every domain rejection becomes a typed result", async () => {
    asAdministrator();

    mocks.editReservationStay.mockRejectedValueOnce(
      new ReservationStayRequiresRoomError()
    );
    await expect(
      editAdminReservationStayAction(formData({ id: "r6", rooms: "room-a:2" }))
    ).resolves.toMatchObject({ code: "validation", ok: false });

    mocks.editReservationStay.mockRejectedValueOnce(
      new ReservationStayRoomCapacityExceededError("room-a", 9, 4)
    );
    await expect(
      editAdminReservationStayAction(formData({ id: "r6", rooms: "room-a:9" }))
    ).resolves.toMatchObject({
      code: "validation",
      message:
        "Una de las habitaciones no admite la cantidad de personas indicada.",
      ok: false,
    });

    mocks.editReservationStay.mockRejectedValueOnce(
      new RoomLockConflictError([], "room-a")
    );
    await expect(
      editAdminReservationStayAction(formData({ id: "r6", rooms: "room-a:2" }))
    ).resolves.toMatchObject({ code: "conflict", ok: false });

    mocks.editReservationStay.mockRejectedValueOnce(new Error("boom"));
    await expect(
      editAdminReservationStayAction(formData({ id: "r6", rooms: "room-a:2" }))
    ).resolves.toMatchObject({ code: "failure", ok: false });
  });
});

describe("the action trusts no client-supplied money (task 5.2)", () => {
  it("ignores prices, capacities and totals present in the submission", async () => {
    asAdministrator();
    mocks.editReservationStay.mockResolvedValueOnce({});

    await editAdminReservationStayAction(
      formData({
        capacity: "99",
        checkIn: "2030-04-01",
        checkOut: "2030-04-03",
        id: "r7",
        nightlyPriceClp: "1",
        rooms: "room-a:2",
        subtotalClp: "1",
        totalClp: "1",
      })
    );

    const call = mocks.editReservationStay.mock.calls.at(-1)![0];
    expect(Object.keys(call.input).sort()).toEqual([
      "actorUserId",
      "checkIn",
      "checkOut",
      "items",
      "reservationId",
    ]);
    expect(JSON.stringify(call.input)).not.toContain("99");
    // The rates come from the server's own room query, never the form.
    expect(call.getRoomRates).toBeTypeOf("function");
  });

  it("takes the occupancy only from the rooms selection, not a separate field", async () => {
    asAdministrator();
    mocks.editReservationStay.mockResolvedValueOnce({});

    await editAdminReservationStayAction(
      formData({ guestCount: "40", id: "r8", rooms: "room-a:2" })
    );

    const call = mocks.editReservationStay.mock.calls.at(-1)![0];
    expect(call.input.items).toEqual([{ guestCount: 2, roomId: "room-a" }]);
  });
});
