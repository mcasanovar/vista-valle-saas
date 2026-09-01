import { afterEach, describe, expect, it, vi } from "vitest";

const { requireAdministrator, getRoomReadSource } = vi.hoisted(() => ({
  getRoomReadSource: vi.fn(),
  requireAdministrator: vi.fn(),
}));

vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator,
}));
vi.mock("@/features/rooms", () => ({
  getRoomReadSource,
}));

import {
  getManualReservationInitialData,
  type ManualReservationInitialData,
} from "@/features/admin/manual-reservation-data";

const trustedRoomSource = {
  listActive: () => [
    {
      active: true,
      amenities: ["Calefacción"],
      bathroom: "Privado",
      bedConfiguration: "Matrimonial",
      capacity: 2,
      description: "Datos de catálogo que no se exponen por esta frontera",
      id: "room-authoritative",
      images: [],
      isDemonstration: false,
      name: "Habitación autorizada",
      nightlyPriceClp: 99_999,
      slug: "habitacion-autorizada",
    },
  ],
};

afterEach(() => {
  vi.resetAllMocks();
});

describe("manual reservation initial-data boundary", () => {
  it("requires an administrator before reading the room source", async () => {
    requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));

    await expect(getManualReservationInitialData()).rejects.toThrow(
      "unauthorized"
    );
    expect(getRoomReadSource).not.toHaveBeenCalled();
  });

  it("returns only safe trusted room metadata and an explicit no-dates state", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    getRoomReadSource.mockResolvedValueOnce(trustedRoomSource);

    await expect(getManualReservationInitialData()).resolves.toEqual({
      availability: { status: "dates_required" },
      rooms: [
        {
          capacity: 2,
          id: "room-authoritative",
          name: "Habitación autorizada",
        },
      ],
    } satisfies ManualReservationInitialData);
  });

  it("has no client-supplied state input that could override the source", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    getRoomReadSource.mockResolvedValueOnce(trustedRoomSource);

    const boundaryWithIgnoredRuntimeArgument =
      getManualReservationInitialData as unknown as (
        candidate: Record<string, unknown>
      ) => Promise<ManualReservationInitialData>;
    const result = await boundaryWithIgnoredRuntimeArgument({
      availability: false,
      price: 1,
      rooms: ["client-controlled-room"],
      status: "cancelled",
    });

    expect(result.rooms).toEqual([
      {
        capacity: 2,
        id: "room-authoritative",
        name: "Habitación autorizada",
      },
    ]);
    expect(getRoomReadSource).toHaveBeenCalledOnce();
  });
});
