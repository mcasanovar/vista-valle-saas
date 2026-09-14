import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { RoomDetailPriceCard } from "@/features/reservations/room-detail-price-card";

describe("RoomDetailPriceCard", () => {
  it("offers an occupancy option per guest up to the room's real capacity", () => {
    render(
      <RoomDetailPriceCard
        slug="habitacion-triple-demo"
        capacity={3}
        nightlyPriceClp={90000}
        occupancyPrices={[]}
      />
    );
    const group = screen.getByRole("group", { name: "Cantidad de personas" });
    expect(group).toHaveTextContent("1 persona");
    expect(group).toHaveTextContent("2 personas");
    expect(group).toHaveTextContent("3 personas");
  });

  it("does not offer an occupancy beyond the room's capacity", () => {
    render(
      <RoomDetailPriceCard
        slug="habitacion-doble-demo"
        capacity={2}
        nightlyPriceClp={70000}
        occupancyPrices={[
          { occupancy: 1, priceClp: 55000 },
          { occupancy: 2, priceClp: 70000 },
        ]}
      />
    );
    const group = screen.getByRole("group", { name: "Cantidad de personas" });
    expect(group).toHaveTextContent("1 persona");
    expect(group).toHaveTextContent("2 personas");
    expect(screen.queryByText("3 personas")).not.toBeInTheDocument();
  });

  it("hides the occupancy selector entirely for a single-guest room", () => {
    render(
      <RoomDetailPriceCard
        slug="habitacion-individual-demo"
        capacity={1}
        nightlyPriceClp={55000}
        occupancyPrices={[]}
      />
    );
    expect(
      screen.queryByRole("group", { name: "Cantidad de personas" })
    ).not.toBeInTheDocument();
  });
});
