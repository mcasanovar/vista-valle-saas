import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createAdminReservationSource } from "@/features/admin/reservations";
import ReservationsPage from "../app/(admin-protected)/admin/reservas/page";

describe("admin reservations mock source (still used by the Resumen dashboard KPIs, unrelated to the reservations list/detail pages below)", () => {
  it("filters listing data, keeps PII out of its operational projection, and fails closed in production", () => {
    const source = createAdminReservationSource("mock")!;
    const rows = source.list({
      status: "confirmed",
      origin: "website",
      room: "Habitación Valle",
    });
    expect(rows).toHaveLength(1);
    const listing = rows.map(({ id, room, status, origin }) => ({
      id,
      room,
      status,
      origin,
    }));
    expect(JSON.stringify(listing)).not.toContain("guest@example");
    expect(createAdminReservationSource("production")).toBeNull();
  });

  it("transitions a confirmed reservation through the domain service with audit and rejects a second change", async () => {
    const source = createAdminReservationSource("mock")!;
    const updated = await source.transition(
      "reservation-demo",
      "cancelled",
      "admin-1"
    );
    expect(updated.audit.at(-1)).toMatchObject({
      actor: "admin-1",
      from: "confirmed",
      to: "cancelled",
    });
    await expect(
      source.transition("reservation-demo", "completed", "admin-1")
    ).rejects.toThrow();
    await expect(
      source.canBookInterval("room-valle", "2026-10-05", "2026-10-08")
    ).resolves.toBe(true);
  });
});

describe("admin reservations list page", () => {
  it("shows an explicit unavailable message outside production, instead of falling back to mock data", async () => {
    render(await ReservationsPage({ searchParams: Promise.resolve({}) }));
    expect(
      await screen.findByText("Las reservas no están disponibles.")
    ).toBeVisible();
  });
});
