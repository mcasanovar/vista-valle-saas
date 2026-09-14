import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const reducedMotion = vi.hoisted(() => ({ current: false }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/presentation/organisms/motion", () => ({
  usePublicReducedMotion: () => reducedMotion.current,
}));

import { RoomDetailSelectionButton } from "@/features/reservations/room-detail-selection-button";
import { RoomCard } from "@/presentation/organisms";

function setReducedMotion(matches: boolean) {
  reducedMotion.current = matches;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

describe("prebooking cart add feedback", () => {
  beforeEach(() => {
    router.push.mockReset();
    router.replace.mockReset();
    window.sessionStorage.clear();
    window.history.replaceState(
      {},
      "",
      "/disponibilidad?checkIn=2026-10-05&checkOut=2026-10-07"
    );
    setReducedMotion(false);
  });

  it("updates selection immediately and starts a transform/opacity travel animation from a result", () => {
    window.history.replaceState({}, "", "/disponibilidad?checkIn=2061-02-10&checkOut=2061-02-13&guests=1");
    render(
      <RoomCard
        roomSlug="valle"
        name="Valle"
        capacity="2 huéspedes"
        beds="1 cama"
        price={50_000}
        detailHref="/habitaciones/valle"
        selectable
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar a la reserva" })
    );

    expect(router.push).toHaveBeenCalledWith(
      "/disponibilidad?checkIn=2061-02-10&checkOut=2061-02-13&guests=1&rooms=valle%3A1",
      { scroll: false }
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ya se encuentra agregada"
    );
    expect(
      screen.getByRole("button", { name: "Quitar de la reserva" })
    ).toBeInTheDocument();
    expect(document.querySelector("[data-cart-animation]")).toBeTruthy();
  });

  it("uses visible live feedback without a travel animation when motion is reduced", () => {
    setReducedMotion(true);
    render(
      <RoomCard
        roomSlug="valle"
        name="Valle"
        capacity="2 huéspedes"
        beds="1 cama"
        price={50_000}
        detailHref="/habitaciones/valle"
        selectable
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar a la reserva" })
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ya se encuentra agregada"
    );
    expect(
      screen.getByRole("button", { name: "Quitar de la reserva" })
    ).toBeInTheDocument();
    expect(document.querySelector("[data-cart-animation]")).toBeNull();
  });

  it("keeps the same immediate feedback and travel animation from room detail", () => {
    render(<RoomDetailSelectionButton slug="valle" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar a la reserva" })
    );

    expect(router.replace).toHaveBeenCalledWith(
      "/disponibilidad?checkIn=2026-10-05&checkOut=2026-10-07&rooms=valle%3A1",
      { scroll: false }
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Ya se encuentra agregada"
    );
    expect(
      screen.getByRole("button", { name: "Quitar de la reserva" })
    ).toBeInTheDocument();
    expect(document.querySelector("[data-cart-animation]")).toBeTruthy();
  });

  it("shows the selected detail state and restores add after removing", () => {
    window.sessionStorage.setItem(
      "vista-valle.public-room-selection.v2",
      JSON.stringify({
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        guests: 1,
        rooms: [{ guestCount: 1, roomId: "valle" }],
      })
    );
    render(<RoomDetailSelectionButton slug="valle" />);
    expect(screen.getByText("Ya se encuentra agregada")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar de la reserva" })
    );
    expect(router.replace).toHaveBeenCalledWith(
      "/disponibilidad?checkIn=2026-10-05&checkOut=2026-10-07",
      { scroll: false }
    );
  });

  it("omits the detail travel animation when motion is reduced", () => {
    setReducedMotion(true);
    render(<RoomDetailSelectionButton slug="valle" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Agregar a la reserva" })
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Ya se encuentra agregada"
    );
    expect(
      screen.getByRole("button", { name: "Quitar de la reserva" })
    ).toBeInTheDocument();
    expect(document.querySelector("[data-cart-animation]")).toBeNull();
  });

  it("shows availability instead of an add control in direct room detail without dates", () => {
    window.history.replaceState({}, "", "/habitaciones/valle");
    render(<RoomDetailSelectionButton slug="valle" />);

    expect(
      screen.queryByRole("link", { name: "Consultar disponibilidad" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Agregar a la reserva" })
    ).toBeNull();
  });
});
