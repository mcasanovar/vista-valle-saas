import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { notFoundMock } = vi.hoisted(() => ({ notFoundMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import RoomDetailPage from "../app/habitaciones/[slug]/page";
import {
  createRoomReadSource,
  mockDemoRooms,
  type RoomReadModel,
} from "@/features/rooms";
import {
  RoomCatalogueTemplate,
  RoomDetailTemplate,
} from "@/presentation/templates";

describe("room read source", () => {
  it("lists only active publishable rooms and resolves them by slug", () => {
    const inactiveRoom: RoomReadModel = {
      ...mockDemoRooms[0],
      active: false,
      id: "inactive-demo-room",
      slug: "inactive-demo-room",
    };
    const source = createRoomReadSource("mock", [
      ...mockDemoRooms,
      inactiveRoom,
    ]);

    expect(source.listActive()).toEqual(mockDemoRooms);
    expect(source.getActiveBySlug("habitacion-andes-demo")).toEqual(
      mockDemoRooms[1]
    );
    expect(source.getActiveBySlug("inactive-demo-room")).toBeNull();
  });

  it("rejects fictional demonstration records in production", () => {
    expect(() => createRoomReadSource("production", mockDemoRooms)).toThrow(
      "Demonstration rooms are not permitted in production"
    );
    expect(createRoomReadSource("production", []).listActive()).toEqual([]);
  });
});

describe("room presentation", () => {
  it("renders the mock catalogue with a visible demonstration label and slug links", () => {
    render(<RoomCatalogueTemplate rooms={mockDemoRooms} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Habitaciones" })
    ).toBeVisible();
    expect(screen.getByText("Contenido de demostración")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "Ver habitación" })[0]
    ).toHaveAttribute("href", "/habitaciones/habitacion-valle-demo");
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getAllByText(/Baño privado de demostración/)).toHaveLength(3);
    expect(screen.getAllByText("Wi‑Fi")).toHaveLength(3);
  });

  it("renders room details, local images, amenities, and the reservation anchor", () => {
    render(<RoomDetailTemplate room={mockDemoRooms[0]} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Habitación Individual",
      })
    ).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Imagen de demostración para la habitación Valle",
      })
    ).toHaveAttribute("src", expect.stringContaining("room-1.jpeg"));
    expect(screen.getByText("Wi‑Fi")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Consultar disponibilidad" })
    ).toHaveAttribute("href", "/disponibilidad?room=habitacion-valle-demo");
  });
});

describe("room detail route", () => {
  it("uses Next notFound for a nonexistent slug", async () => {
    notFoundMock.mockImplementation(() => {
      throw new Error("not found");
    });

    await expect(
      RoomDetailPage({ params: Promise.resolve({ slug: "unknown-room" }) })
    ).rejects.toThrow("not found");
    expect(notFoundMock).toHaveBeenCalledOnce();
  });
});
