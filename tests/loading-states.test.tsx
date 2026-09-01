import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "@/presentation/atoms";
import { AvailabilityResultsSkeleton } from "../app/disponibilidad/results";
import RoomCatalogueLoading from "../app/habitaciones/loading";
import RoomDetailLoading from "../app/habitaciones/[slug]/loading";
import ReservationsLoading from "../app/(admin-protected)/admin/reservas/loading";
import CalendarLoading from "../app/(admin-protected)/admin/calendario/loading";

describe("Skeleton atom", () => {
  it("renders a decorative pulsing block with the given size classes", () => {
    render(<Skeleton className="h-10 w-20" />);
    const block = document.querySelector('[aria-hidden="true"]');
    expect(block).toBeVisible();
    expect(block).toHaveClass("animate-pulse", "h-10", "w-20");
  });
});

describe("route loading skeletons", () => {
  it("room catalogue loading is a busy region with card-shaped skeletons", () => {
    render(<RoomCatalogueLoading />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando habitaciones"
    );
    expect(main.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(
      3
    );
  });

  it("room detail loading is a busy region with gallery, feature, and price shapes", () => {
    render(<RoomDetailLoading />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Cargando habitación");
    expect(main.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(
      5
    );
  });

  it("availability results skeleton is a busy region with result-card shapes", () => {
    render(<AvailabilityResultsSkeleton />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando disponibilidad"
    );
    expect(
      document.querySelectorAll('[aria-hidden="true"]').length
    ).toBeGreaterThanOrEqual(3);
  });

  it("admin reservations and calendar loading are busy regions, not full-screen overlays", () => {
    const { unmount } = render(<ReservationsLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando reservas");
    unmount();

    render(<CalendarLoading />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando calendario");
  });
});
