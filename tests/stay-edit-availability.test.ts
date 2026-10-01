import { afterEach, describe, expect, it, vi } from "vitest";

const {
  getAvailabilitySearchRepository,
  getRoomReadSource,
  requireAdministrator,
} = vi.hoisted(() => ({
  getAvailabilitySearchRepository: vi.fn(),
  getRoomReadSource: vi.fn(),
  requireAdministrator: vi.fn(),
}));

vi.mock("@/features/availability/search-source", () => ({
  getAvailabilitySearchRepository,
}));
vi.mock("@/features/rooms", () => ({ getRoomReadSource }));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator,
}));

import { createLodgingInterval } from "@/features/availability";
import {
  getStayEditAvailability,
  resolveStayEditAvailability,
  StayEditAvailabilityAuthorizationError,
  StayEditAvailabilityInputError,
} from "@/features/admin/stay-edit-availability";

/** Fills the fields of a `RoomReadModel` this boundary does not read. */
function roomOf(
  overrides: Readonly<{
    capacity: number;
    id: string;
    name: string;
    nightlyPriceClp: number;
    occupancyPrices: readonly Readonly<{
      occupancy: number;
      priceClp: number;
    }>[];
  }>
) {
  return Object.freeze({
    active: true,
    amenities: [],
    bathroom: "privado",
    bedConfiguration: "matrimonial",
    description: "",
    images: [],
    isDemonstration: false,
    slug: overrides.id,
    ...overrides,
  });
}

const roomSource = {
  getActiveBySlug: () => null,
  listActive: () => [
    roomOf({
      capacity: 2,
      id: "room-a",
      name: "Habitación A",
      nightlyPriceClp: 55_000,
      occupancyPrices: [],
    }),
    roomOf({
      capacity: 4,
      id: "room-b",
      name: "Habitación B",
      nightlyPriceClp: 70_000,
      occupancyPrices: [{ occupancy: 2, priceClp: 70_000 }],
    }),
  ],
};

/** Occupancy repository whose entries are declared per room. */
function repositoryOf(
  occupancyByRoom: Record<
    string,
    readonly Readonly<{
      checkIn: string;
      checkOut: string;
      source: "reservation" | "hold" | "block";
      sourceId: string;
    }>[]
  >
) {
  return {
    listOccupyingIntervals: async (roomId: string) =>
      (occupancyByRoom[roomId] ?? []).map((entry) =>
        Object.freeze({
          interval: createLodgingInterval(entry.checkIn, entry.checkOut),
          source: entry.source,
          sourceId: entry.sourceId,
        })
      ),
  };
}

afterEach(() => vi.resetAllMocks());

describe("stay-edit availability has no minimum-date rule (task 3.1)", () => {
  it("offers rooms for an interval whose check-in is already in the past", async () => {
    const availability = await resolveStayEditAvailability(
      { checkIn: "2020-03-01", checkOut: "2020-03-05" },
      { availabilityRepository: repositoryOf({}), roomSource }
    );

    expect(availability.checkIn).toBe("2020-03-01");
    expect(availability.rooms.map((room) => room.id)).toEqual([
      "room-a",
      "room-b",
    ]);
  });

  it("still rejects a malformed or inverted interval", async () => {
    await expect(
      resolveStayEditAvailability(
        { checkIn: "2026-05-10", checkOut: "2026-05-10" },
        { availabilityRepository: repositoryOf({}), roomSource }
      )
    ).rejects.toBeInstanceOf(StayEditAvailabilityInputError);

    await expect(
      resolveStayEditAvailability(
        { checkIn: "no-es-fecha", checkOut: "2026-05-12" },
        { availabilityRepository: repositoryOf({}), roomSource }
      )
    ).rejects.toBeInstanceOf(StayEditAvailabilityInputError);
  });

  it("excludes a room another reservation occupies in the interval", async () => {
    const availability = await resolveStayEditAvailability(
      { checkIn: "2026-05-10", checkOut: "2026-05-12" },
      {
        availabilityRepository: repositoryOf({
          "room-b": [
            {
              checkIn: "2026-05-11",
              checkOut: "2026-05-14",
              source: "reservation",
              sourceId: "other-reservation",
            },
          ],
        }),
        roomSource,
      }
    );

    expect(availability.rooms.map((room) => room.id)).toEqual(["room-a"]);
  });
});

describe("the reservation's own rooms stay selectable (task 3.2)", () => {
  it("does not report a room as taken when its only occupancy is the edited reservation", async () => {
    const occupancy = repositoryOf({
      "room-a": [
        {
          checkIn: "2026-05-10",
          checkOut: "2026-05-12",
          source: "reservation",
          sourceId: "edited-reservation",
        },
      ],
    });

    const withoutExclusion = await resolveStayEditAvailability(
      { checkIn: "2026-05-10", checkOut: "2026-05-12" },
      { availabilityRepository: occupancy, roomSource }
    );
    expect(withoutExclusion.rooms.map((room) => room.id)).toEqual(["room-b"]);

    const withExclusion = await resolveStayEditAvailability(
      {
        checkIn: "2026-05-10",
        checkOut: "2026-05-12",
        excludeReservationId: "edited-reservation",
      },
      { availabilityRepository: occupancy, roomSource }
    );
    expect(withExclusion.rooms.map((room) => room.id)).toEqual([
      "room-a",
      "room-b",
    ]);
  });

  it("excludes only the edited reservation, never a hold or a block on the same room", async () => {
    const availability = await resolveStayEditAvailability(
      {
        checkIn: "2026-05-10",
        checkOut: "2026-05-12",
        excludeReservationId: "edited-reservation",
      },
      {
        availabilityRepository: repositoryOf({
          "room-a": [
            {
              checkIn: "2026-05-10",
              checkOut: "2026-05-12",
              source: "reservation",
              sourceId: "edited-reservation",
            },
          ],
          "room-b": [
            {
              checkIn: "2026-05-10",
              checkOut: "2026-05-12",
              source: "block",
              sourceId: "edited-reservation",
            },
          ],
        }),
        roomSource,
      }
    );

    // room-b's block shares the id but not the source: it must still block.
    expect(availability.rooms.map((room) => room.id)).toEqual(["room-a"]);
  });
});

describe("boundary is administrative only (task 3.3)", () => {
  it("rejects a non-administrator before reading trusted sources", async () => {
    requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));

    await expect(
      getStayEditAvailability({
        checkIn: "2026-05-10",
        checkOut: "2026-05-12",
      })
    ).rejects.toBeInstanceOf(StayEditAvailabilityAuthorizationError);

    expect(getRoomReadSource).not.toHaveBeenCalled();
    expect(getAvailabilitySearchRepository).not.toHaveBeenCalled();
  });

  it("is not imported by anything outside the administrative feature", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(full)) continue;
        // The administrative feature and its own API route are the
        // legitimate consumers; everything else must not reach this module.
        if (full.includes(join("src", "features", "admin"))) continue;
        if (full.includes(join("app", "api", "admin"))) continue;
        if (readFileSync(full, "utf8").includes("stay-edit-availability")) {
          offenders.push(full);
        }
      }
    };
    for (const root of ["src", "app"]) walk(root);

    expect(offenders).toEqual([]);
  });

  it("reads trusted sources only after the administrator check passes", async () => {
    requireAdministrator.mockResolvedValueOnce(undefined);
    getRoomReadSource.mockResolvedValueOnce(roomSource);
    getAvailabilitySearchRepository.mockReturnValueOnce(repositoryOf({}));

    const availability = await getStayEditAvailability({
      checkIn: "2026-05-10",
      checkOut: "2026-05-12",
    });

    expect(availability.rooms).toHaveLength(2);
    expect(requireAdministrator).toHaveBeenCalledOnce();
  });
});
