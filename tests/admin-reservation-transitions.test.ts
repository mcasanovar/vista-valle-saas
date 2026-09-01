import { describe, expect, it } from "vitest";
import { createAdminReservationSource } from "@/features/admin/reservations";
describe("mock administrative reservation transitions", () => {
  it("uses shared transitions, audits and releases availability", async () => {
    const source = createAdminReservationSource("mock");
    if (!source) throw new Error("missing");
    const updated = await source.transition(
      "reservation-demo",
      "cancelled",
      "admin-1"
    );
    expect(updated.audit).toMatchObject([
      { actor: "admin-1", from: "confirmed", to: "cancelled" },
    ]);
    await expect(
      source.canBookInterval("room-valle", "2026-10-05", "2026-10-08")
    ).resolves.toBe(true);
    await expect(
      source.transition("reservation-demo", "completed", "admin-1")
    ).rejects.toThrow();
  });
  it("supports terminal states, filters, and production fails closed", async () => {
    for (const to of ["completed", "no_show"] as const) {
      const source = createAdminReservationSource("mock");
      if (!source) throw new Error("missing");
      expect(
        (await source.transition("reservation-demo", to, "admin-2")).status
      ).toBe(to);
    }
    const source = createAdminReservationSource("mock");
    expect(
      source?.list({
        status: "confirmed",
        origin: "website",
        room: "Habitación Valle",
      })
    ).toHaveLength(1);
    expect(createAdminReservationSource("production")).toBeNull();
  });
});
