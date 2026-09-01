import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/habitaciones/habitacion-valle-demo",
  useSearchParams: () => new URLSearchParams(),
}));

import { mockDemoRooms, type RoomReadModel } from "@/features/rooms";
import { RoomDetailTemplate } from "@/presentation/templates";

const demoRoom = mockDemoRooms[0];
const productionRoom: RoomReadModel = {
  ...demoRoom,
  isDemonstration: false,
};

describe("RoomDetailTemplate sections", () => {
  it("renders header, demo notice, title, gallery, features, and price in order", () => {
    render(<RoomDetailTemplate room={demoRoom} />);

    const main = screen.getByRole("main");
    const sectionOrder = within(main)
      .getAllByText(
        /Contenido de demostración|Habitación Individual|Características|Desde/
      )
      .map((node) => node.textContent);

    expect(sectionOrder).toEqual([
      "Contenido de demostración",
      "Habitación Individual",
      "Características",
      expect.stringContaining("Desde"),
    ]);
    expect(
      screen.getByRole("list", { name: `Galería de ${demoRoom.name}` })
    ).toBeVisible();
  });

  it("does not render the demonstration notice for a non-demonstration room", () => {
    render(<RoomDetailTemplate room={productionRoom} />);

    expect(
      screen.queryByText("Contenido de demostración")
    ).not.toBeInTheDocument();
  });
});

describe("RoomDetailTemplate features and services", () => {
  it("renders an icon-labeled indicator for capacity, beds, and bathroom", () => {
    render(<RoomDetailTemplate room={demoRoom} />);

    const featuresSection = screen.getByRole("heading", {
      name: "Características",
    }).parentElement as HTMLElement;

    for (const [label, value] of [
      ["Capacidad", `${demoRoom.capacity} huéspedes`],
      ["Camas", demoRoom.bedConfiguration],
      ["Baño", demoRoom.bathroom],
    ]) {
      const term = within(featuresSection).getByText(label);
      expect(term.nextElementSibling).toHaveTextContent(value);
      const iconBadge =
        term.parentElement?.parentElement?.previousElementSibling;
      expect(iconBadge?.querySelector("svg")).toBeTruthy();
    }
  });

  it("renders every amenity as a checked item", () => {
    render(<RoomDetailTemplate room={demoRoom} />);

    for (const amenity of demoRoom.amenities) {
      const item = screen.getByText(amenity).closest("li");
      expect(item?.querySelector("svg")).toBeTruthy();
    }
  });
});

describe("RoomDetailTemplate price card", () => {
  it("links the primary action to availability and the secondary action back to the catalogue", () => {
    render(<RoomDetailTemplate room={demoRoom} />);

    expect(
      screen.getByRole("link", { name: "Consultar disponibilidad" })
    ).toHaveAttribute(
      "href",
      `/disponibilidad?room=${demoRoom.slug}`
    );

    const backLink = screen.getByRole("link", {
      name: "Volver a habitaciones",
    });
    expect(backLink).toHaveAttribute("href", "/habitaciones");
    expect(backLink.querySelector("svg")).toBeTruthy();
  });

  it("honors an explicit availabilityHref override for the primary action", () => {
    render(
      <RoomDetailTemplate
        room={demoRoom}
        availabilityHref="/disponibilidad?room=habitacion-valle-demo&adultos=2"
      />
    );

    expect(
      screen.getByRole("link", { name: "Consultar disponibilidad" })
    ).toHaveAttribute(
      "href",
      "/disponibilidad?room=habitacion-valle-demo&adultos=2"
    );
  });
});
