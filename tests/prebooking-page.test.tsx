import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import PrebookingPage from "../app/pre-reserva/page";

describe("/pre-reserva", () => {
  it("renders a recoverable empty-cart state for direct links", async () => {
    render(await PrebookingPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Tu reserva está vacía" })
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Volver a disponibilidad" })
    ).toHaveAttribute("href", "/disponibilidad");
  });

  it("accepts a direct selected-room link and shows its authoritative review", async () => {
    render(
      await PrebookingPage({
        searchParams: Promise.resolve({
          checkIn: "2032-02-10",
          checkOut: "2032-02-13",
          guests: "1",
          rooms: "habitacion-valle-demo",
        }),
      })
    );

    expect(
      screen.getByRole("heading", { name: "Revisa tu reserva" })
    ).toBeVisible();
    expect(screen.getAllByText("$165.000")).toHaveLength(2);
  });
});
