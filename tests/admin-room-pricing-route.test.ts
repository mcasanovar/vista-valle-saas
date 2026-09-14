import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdministrator, getRoomReadSource, createDatabaseBoundary } =
  vi.hoisted(() => ({
    requireAdministrator: vi.fn(),
    getRoomReadSource: vi.fn(),
    createDatabaseBoundary: vi.fn(),
  }));

vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator,
}));
vi.mock("@/infrastructure/database/server", () => ({ createDatabaseBoundary }));
vi.mock("@/features/rooms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/rooms")>()),
  getRoomReadSource,
}));

import { GET, PUT } from "../app/api/admin/habitaciones/[roomId]/tarifas/route";
import { getCanonicalMockRoomPricingRepository } from "@/features/rooms";

const doble = Object.freeze({
  active: true,
  amenities: [],
  bathroom: "Privado",
  bedConfiguration: "2 camas",
  capacity: 2,
  description: "Doble",
  id: "room-doble",
  images: [],
  isDemonstration: false,
  name: "Habitación Doble",
  nightlyPriceClp: 70_000,
  occupancyPrices: [],
  slug: "doble",
});

const individual = Object.freeze({
  ...doble,
  capacity: 1,
  id: "room-individual",
  name: "Habitación Individual",
  slug: "individual",
});

function paramsFor(roomId: string) {
  return { params: Promise.resolve({ roomId }) };
}

describe("admin room pricing API route", () => {
  beforeEach(() => {
    requireAdministrator.mockReset();
    getRoomReadSource.mockReset();
    createDatabaseBoundary.mockReset();
    createDatabaseBoundary.mockReturnValue({ context: "mock" });
    getRoomReadSource.mockResolvedValue({
      getActiveBySlug: () => null,
      listActive: () => [doble, individual],
    });
    requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
  });

  it("rejects an unauthenticated request", async () => {
    requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));

    const response = await GET(
      new Request("http://localhost/api/admin/habitaciones/room-doble/tarifas"),
      paramsFor("room-doble")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown room", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/habitaciones/unknown/tarifas"),
      paramsFor("unknown")
    );

    expect(response.status).toBe(404);
  });

  it("resolves the base price for both occupancies when no tariff is configured yet", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/habitaciones/room-doble/tarifas"),
      paramsFor("room-doble")
    );

    expect(await response.json()).toMatchObject({
      priceOneGuestClp: 70_000,
      priceTwoGuestsClp: 70_000,
    });
  });

  it("saves a valid differentiated tariff and reflects it on the next GET", async () => {
    const putResponse = await PUT(
      new Request("http://localhost/api/admin/habitaciones/room-doble/tarifas", {
        body: JSON.stringify({ priceOneGuestClp: 55_000, priceTwoGuestsClp: 70_000 }),
        method: "PUT",
      }),
      paramsFor("room-doble")
    );
    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toMatchObject({
      priceOneGuestClp: 55_000,
      priceTwoGuestsClp: 70_000,
    });

    const getResponse = await GET(
      new Request("http://localhost/api/admin/habitaciones/room-doble/tarifas"),
      paramsFor("room-doble")
    );
    expect(await getResponse.json()).toMatchObject({
      priceOneGuestClp: 55_000,
      priceTwoGuestsClp: 70_000,
    });
  });

  it("rejects an invalid price without saving", async () => {
    const response = await PUT(
      new Request("http://localhost/api/admin/habitaciones/room-doble/tarifas", {
        body: JSON.stringify({ priceOneGuestClp: -5, priceTwoGuestsClp: 70_000 }),
        method: "PUT",
      }),
      paramsFor("room-doble")
    );

    expect(response.status).toBe(400);
  });

  it("mirrors the single price for a capacity-1 room", async () => {
    const putResponse = await PUT(
      new Request(
        "http://localhost/api/admin/habitaciones/room-individual/tarifas",
        {
          body: JSON.stringify({
            priceOneGuestClp: 45_000,
            priceTwoGuestsClp: 45_000,
          }),
          method: "PUT",
        }
      ),
      paramsFor("room-individual")
    );

    expect(await putResponse.json()).toMatchObject({
      priceOneGuestClp: 45_000,
      priceTwoGuestsClp: 45_000,
    });
    expect(
      getCanonicalMockRoomPricingRepository()
        .audits()
        .some(
          (event) =>
            event.roomId === "room-individual" && event.priceTwoGuestsClp === null
        )
    ).toBe(true);
  });
});
