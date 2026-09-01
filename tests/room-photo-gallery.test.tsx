import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pushMock, replaceMock, backMock, searchParamsRef, pathnameRef } =
  vi.hoisted(() => ({
    pushMock: vi.fn(),
    replaceMock: vi.fn(),
    backMock: vi.fn(),
    searchParamsRef: { current: new URLSearchParams() },
    pathnameRef: { current: "/habitaciones" },
  }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock, back: backMock }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => searchParamsRef.current,
}));

import {
  RoomCard,
  RoomGallery,
  RoomPhotoGalleryProvider,
} from "@/presentation/organisms";

const images = [
  { id: "a", src: "/rooms/room-1.jpeg", alt: "Foto 1" },
  { id: "b", src: "/rooms/room-2.jpeg", alt: "Foto 2" },
];

beforeEach(() => {
  pushMock.mockClear();
  replaceMock.mockClear();
  backMock.mockClear();
  searchParamsRef.current = new URLSearchParams();
  pathnameRef.current = "/habitaciones";
});

function DemoRoomCard() {
  return (
    <RoomCard
      image={images[0]}
      images={images}
      roomSlug="habitacion-demo"
      name="Habitación Demo"
      capacity="2 huéspedes"
      beds="1 cama"
      price={50000}
      detailHref="/habitaciones/habitacion-demo"
      detailLabel="Ver habitación"
    />
  );
}

describe("RoomPhotoGalleryProvider", () => {
  it("no muestra el carrusel por defecto", () => {
    render(
      <RoomPhotoGalleryProvider>
        <DemoRoomCard />
      </RoomPhotoGalleryProvider>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre el carrusel con todas las fotos al presionar la imagen de la tarjeta y refleja el estado en la URL", async () => {
    const user = userEvent.setup();
    render(
      <RoomPhotoGalleryProvider>
        <DemoRoomCard />
      </RoomPhotoGalleryProvider>
    );

    await user.click(
      screen.getByRole("button", { name: "Ver fotos de Habitación Demo" })
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/habitaciones?habitacion=habitacion-demo&foto=1",
      { scroll: false }
    );
  });

  it('el botón "Ver más" sigue navegando al detalle sin abrir el carrusel', () => {
    render(
      <RoomPhotoGalleryProvider>
        <DemoRoomCard />
      </RoomPhotoGalleryProvider>
    );

    expect(
      screen.getByRole("link", { name: "Ver habitación" })
    ).toHaveAttribute("href", "/habitaciones/habitacion-demo");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("abre el carrusel en la foto seleccionada desde la galería de detalle", async () => {
    pathnameRef.current = "/habitaciones/habitacion-demo";
    const user = userEvent.setup();
    render(
      <RoomPhotoGalleryProvider singleRoomSlug="habitacion-demo">
        <RoomGallery roomSlug="habitacion-demo" images={images} />
      </RoomPhotoGalleryProvider>
    );

    await user.click(screen.getByRole("button", { name: /Ver foto 2 de 2/ }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/habitaciones/habitacion-demo?foto=2",
      { scroll: false }
    );
  });

  it("abre el carrusel automáticamente si la página carga con un deep-link válido", async () => {
    searchParamsRef.current = new URLSearchParams(
      "habitacion=habitacion-demo&foto=2"
    );
    render(
      <RoomPhotoGalleryProvider>
        <DemoRoomCard />
      </RoomPhotoGalleryProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("ignora un deep-link con habitación o foto inválida sin romper la página", async () => {
    searchParamsRef.current = new URLSearchParams(
      "habitacion=otra-habitacion&foto=abc"
    );
    render(
      <RoomPhotoGalleryProvider>
        <DemoRoomCard />
      </RoomPhotoGalleryProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Ver fotos de Habitación Demo" })
      ).toBeVisible();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
