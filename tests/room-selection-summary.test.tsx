import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
import { RoomSelectionSummary } from "@/features/reservations/room-selection-summary";

describe("RoomSelectionSummary", () => {
  it("does not render an empty cart", () => {
    window.history.replaceState(
      {},
      "",
      "/disponibilidad?checkIn=2026-10-05&checkOut=2026-10-08"
    );
    render(<RoomSelectionSummary rooms={[]} />);
    expect(screen.queryByLabelText("Carro de reserva")).not.toBeInTheDocument();
  });
  it("shows selected room subtotals and aggregate total for shared dates", () => {
    window.history.replaceState(
      {},
      "",
      "/disponibilidad?checkIn=2026-10-05&checkOut=2026-10-08&rooms=valle,andes"
    );
    render(
      <RoomSelectionSummary
        rooms={[
          { id: "1", slug: "valle", name: "Valle", nightlyPriceClp: 50_000 },
          { id: "2", slug: "andes", name: "Andes", nightlyPriceClp: 70_000 },
        ]}
      />
    );
    const cart = screen.getByLabelText("Carro de reserva");
    expect(cart).toBeInTheDocument();
    expect(cart).toHaveStyle({ opacity: "0" });
    expect(cart.querySelectorAll("[data-cart-zone]")).toHaveLength(3);
    expect(cart.querySelector('[data-cart-zone="identity"]')).toHaveTextContent(
      "Carro de reservas"
    );
    expect(cart.querySelector('[data-cart-zone="summary"]')).toHaveTextContent(
      "2 ítems agregados"
    );
    expect(cart.querySelector('[data-cart-zone="checkout"]')).toHaveTextContent(
      "Subtotal"
    );
    expect(screen.getByText("$360.000")).toBeInTheDocument();
  });
  it("provides a keyboard-accessible review link for a single room", () => {
    window.history.replaceState(
      {},
      "",
      "/disponibilidad?checkIn=2026-10-05&checkOut=2026-10-08&rooms=valle"
    );
    render(
      <RoomSelectionSummary
        rooms={[
          { id: "1", slug: "valle", name: "Valle", nightlyPriceClp: 50_000 },
        ]}
      />
    );
    const cart = screen.getByLabelText("Carro de reserva");
    const review = screen.getByRole("link", {
      name: /Ver carrito con 1 ítem agregado/,
    });

    expect(cart).toHaveAttribute("aria-live", "polite");
    expect(cart.className).toContain("safe-area-inset-bottom");
    expect(cart.className).toContain("rounded-[2rem]");
    expect(
      cart.querySelector('[data-cart-zone="summary"]')?.className
    ).toContain("tablet:border-l");
    expect(review).toHaveAttribute(
      "href",
      expect.stringContaining("/pre-reserva?")
    );
    expect(review.className).toContain("focus-visible:outline");
  });
  it("expands room items with keyboard and closes with Escape", () => {
    window.history.replaceState(
      {},
      "",
      "/disponibilidad?checkIn=2026-10-05&checkOut=2026-10-08&rooms=valle,andes"
    );
    render(
      <RoomSelectionSummary
        rooms={[
          { id: "1", slug: "valle", name: "Valle", nightlyPriceClp: 50_000 },
          { id: "2", slug: "andes", name: "Andes", nightlyPriceClp: 70_000 },
        ]}
      />
    );
    const summary = screen.getByRole("button", { name: /2 ítems agregados/ });
    const indicator = document.querySelector("[data-cart-expand-indicator]");
    expect(indicator).toHaveAttribute("data-state", "collapsed");
    fireEvent.keyDown(summary, { key: "Enter" });
    fireEvent.click(summary);
    expect(summary).toHaveAttribute("aria-expanded", "true");
    expect(indicator).toHaveAttribute("data-state", "expanded");
    expect(screen.getByText("Valle")).toBeInTheDocument();
    expect(
      screen.getByText("Valle").closest('[aria-label="Carro de reserva"]')
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(summary).toHaveAttribute("aria-expanded", "false");
  });
  it("removes a detailed room through its accessible action", () => {
    window.history.replaceState(
      {},
      "",
      "/disponibilidad?checkIn=2026-10-05&checkOut=2026-10-08&rooms=valle,andes"
    );
    render(
      <RoomSelectionSummary
        rooms={[
          { id: "1", slug: "valle", name: "Valle", nightlyPriceClp: 50_000 },
          { id: "2", slug: "andes", name: "Andes", nightlyPriceClp: 70_000 },
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /2 ítems agregados/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar Valle de la reserva" })
    );
    expect(router.replace).toHaveBeenCalledWith(
      "/disponibilidad?checkIn=2026-10-05&checkOut=2026-10-08&rooms=andes",
      { scroll: false }
    );
  });
});
