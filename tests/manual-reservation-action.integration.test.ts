import { afterEach, describe, expect, it, vi } from "vitest";

const { requireAdministrator } = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
}));

vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator,
}));

import { createManualReservationAction } from "@/features/admin/manual-reservation-action";
import { mockReservationRepository } from "@/features/reservations";

function manualReservationFormData(email: string) {
  const data = new FormData();
  data.set("checkIn", "2049-04-10");
  data.set("checkOut", "2049-04-12");
  data.set("email", email);
  data.set("firstName", "Reserva");
  data.set("guestCount", "1");
  data.set("lastName", "Manual");
  data.set("origin", "phone");
  data.set("phone", "+56912345678");
  data.append("roomIds", "demo-room-andes");
  return data;
}

afterEach(() => vi.resetAllMocks());

describe("manual reservation action integration", () => {
  it("confirms one valid reservation, then reports a lock conflict without partial effects", async () => {
    requireAdministrator.mockResolvedValue({ user: { id: "admin-integration" } });
    const before = (await mockReservationRepository.listReservations?.()) ?? [];

    const created = await createManualReservationAction(
      manualReservationFormData("first@example.test")
    );
    expect(created.ok).toBe(true);

    const afterCreation =
      (await mockReservationRepository.listReservations?.()) ?? [];
    expect(afterCreation).toHaveLength(before.length + 1);

    const conflict = await createManualReservationAction(
      manualReservationFormData("second@example.test")
    );
    expect(conflict).toMatchObject({
      code: "availability_conflict",
      ok: false,
    });
    expect(
      (await mockReservationRepository.listReservations?.()) ?? []
    ).toHaveLength(afterCreation.length);
  });
});
