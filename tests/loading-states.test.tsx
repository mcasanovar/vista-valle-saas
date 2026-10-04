import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "@/presentation/atoms";
import { AvailabilityResultsSkeleton } from "../app/disponibilidad/results";
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
