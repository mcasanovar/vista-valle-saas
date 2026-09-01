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

import { createMockAvailabilityRepository } from "@/features/availability";
import {
  getManualReservationAvailability,
  ManualReservationAvailabilityAuthorizationError,
} from "@/features/admin/manual-reservation-availability";

const roomSource = {
  listActive: () => [
    {
      capacity: 2,
      id: "trusted-room-a",
      name: "Habitación A",
      nightlyPriceClp: 55000,
    },
    {
      capacity: 4,
      id: "trusted-room-b",
      name: "Habitación B",
      nightlyPriceClp: 70000,
    },
  ],
};

afterEach(() => vi.resetAllMocks());

describe("manual reservation availability boundary", () => {
  it("rejects a non-administrator before reading trusted sources", async () => {
    requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));

    await expect(
      getManualReservationAvailability({
        checkIn: "2033-01-10",
        checkOut: "2033-01-12",
      })
    ).rejects.toBeInstanceOf(ManualReservationAvailabilityAuthorizationError);
    expect(getRoomReadSource).not.toHaveBeenCalled();
    expect(getAvailabilitySearchRepository).not.toHaveBeenCalled();
  });

  it("returns only trusted rooms that are available for submitted dates", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    getRoomReadSource.mockResolvedValueOnce(roomSource);
    getAvailabilitySearchRepository.mockReturnValue(
      createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [
          {
            checkIn: "2033-01-10",
            checkOut: "2033-01-12",
            id: "existing",
            roomId: "trusted-room-a",
            status: "confirmed",
          },
        ],
      })
    );

    await expect(
      getManualReservationAvailability({
        checkIn: "2033-01-10",
        checkOut: "2033-01-12",
      })
    ).resolves.toEqual({
      checkIn: "2033-01-10",
      checkOut: "2033-01-12",
      rooms: [
        {
          capacity: 4,
          id: "trusted-room-b",
          name: "Habitación B",
          nightlyPriceClp: 70000,
        },
      ],
    });
  });

  it("rejects dates before the public booking minimums", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    getRoomReadSource.mockResolvedValueOnce(roomSource);
    getAvailabilitySearchRepository.mockReturnValue(
      createMockAvailabilityRepository({ blocks: [], holds: [], reservations: [] })
    );

    await expect(
      getManualReservationAvailability({
        checkIn: "2000-01-01",
        checkOut: "2000-01-02",
      })
    ).rejects.toMatchObject({
      message: "La fecha de entrada no puede ser anterior a hoy.",
    });
  });
});
