import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MotionConfig } from "framer-motion";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
import { MobileNavigation, Reveal } from "@/presentation/organisms";
import { BookingSearch, Hero, PublicHeader } from "@/presentation/organisms";
import {
  RoomCard,
  RoomGallery,
  RoomPhotoGalleryProvider,
  Services,
} from "@/presentation/organisms";
import {
  CompanyCta,
  FinalCta,
  LocationSection,
  PublicFooter,
  WhatsAppContact,
} from "@/presentation/organisms";

describe("MobileNavigation", () => {
  it("opens, closes on Escape with focus return, and closes on link click", async () => {
    const user = userEvent.setup();
    render(<MobileNavigation items={[{ href: "/x", label: "Enlace" }]} />);
    const trigger = screen.getByRole("button", { name: "Abrir navegación" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole("link", { name: "Enlace" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

it("keeps reveal content fully available when reduced motion is preferred", async () => {
  render(
    <MotionConfig reducedMotion="always">
      <Reveal>
        <button type="button">Acción disponible</button>
      </Reveal>
    </MotionConfig>
  );

  const action = screen.getByRole("button", { name: "Acción disponible" });
  await waitFor(() =>
    expect(action.parentElement).toHaveAttribute("data-motion", "reduced")
  );
  expect(action).toBeVisible();
});

it("renders header skip link and hero required content", () => {
  render(
    <>
      <PublicHeader
        brandLabel="Marca"
        homeHref="/"
        items={[]}
        bookingHref="/reservar"
        bookingLabel="Reservar"
      />
      <Hero
        title="Título"
        copy="Texto"
        primaryCta={{ href: "/r", label: "Ir" }}
        image={{ src: "/image.jpg", alt: "Imagen" }}
      />
    </>
  );
  expect(screen.getByRole("link", { name: /Saltar/ })).toHaveAttribute(
    "href",
    "#main-content"
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Título");
});

it("renders the configured hero photograph as the full-bleed image", () => {
  render(
    <Hero
      title="Título"
      copy="Texto"
      primaryCta={{ href: "/r", label: "Ir" }}
      image={{
        src: "/brand/bg-hero.png",
        alt: "Fachada de Vista Valle con montañas nevadas al fondo",
      }}
    />
  );

  expect(
    screen.getByRole("img", {
      name: "Fachada de Vista Valle con montañas nevadas al fondo",
    })
  ).toHaveAttribute("src", expect.stringContaining("bg-hero.png"));
});

it("submits controlled booking search once while pending", async () => {
  const user = userEvent.setup();
  const submit = vi.fn();
  const dates = vi.fn();
  render(
    <BookingSearch
      formLabel="Buscar"
      checkIn="2026-08-01"
      checkOut="2026-08-02"
      guests={1}
      minGuests={1}
      maxGuests={2}
      checkInLabel="Entrada"
      checkOutLabel="Salida"
      guestsLabel="Huéspedes"
      submitLabel="Buscar disponibilidad"
      onCheckInChange={dates}
      onCheckOutChange={dates}
      onGuestsChange={vi.fn()}
      onSubmit={submit}
    />
  );

  expect(screen.getByRole("form", { name: "Buscar" })).toHaveClass(
    "bg-card",
    "laptop:flex",
    "laptop:justify-between"
  );
  expect(
    screen.getByRole("button", { name: "Buscar disponibilidad" })
  ).toHaveClass(
    "justify-self-center",
    "laptop:justify-self-center",
    "px-3",
    "py-1"
  );
  await user.click(screen.getByRole("button", { name: /Buscar/ }));
  expect(submit).toHaveBeenCalledOnce();
  expect(screen.getByLabelText("Entrada")).toHaveValue("2026-08-01");
});

it("exposes public lodging minimum dates on the availability controls", () => {
  render(
    <BookingSearch
      formLabel="Buscar"
      checkIn=""
      checkOut=""
      guests={1}
      minGuests={1}
      maxGuests={2}
      checkInLabel="Entrada"
      checkOutLabel="Salida"
      guestsLabel="Huéspedes"
      submitLabel="Buscar disponibilidad"
      checkInMin="2030-01-10"
      checkOutMin="2030-01-11"
      onCheckInChange={vi.fn()}
      onCheckOutChange={vi.fn()}
      onGuestsChange={vi.fn()}
      onSubmit={vi.fn()}
    />
  );

  expect(screen.getByLabelText("Entrada")).toHaveAttribute("min", "2030-01-10");
  expect(screen.getByLabelText("Salida")).toHaveAttribute("min", "2030-01-11");
});

it("renders catalogue organisms with articles and lists", () => {
  render(
    <RoomPhotoGalleryProvider singleRoomSlug="habitacion-demo">
      <RoomGallery
        roomSlug="habitacion-demo"
        images={[{ id: "image", src: "/image.jpg", alt: "Imagen" }]}
      />
      <Services
        title="Servicios"
        items={[
          {
            id: "service",
            title: "Servicio",
            description: "Detalle",
            icon: "Check",
          },
        ]}
      />
      <RoomCard
        image={{ src: "/room.jpg", alt: "Habitación" }}
        name="Nombre"
        capacity="Capacidad"
        beds="Camas"
        price={12000}
        detailHref="/detalle"
      />
    </RoomPhotoGalleryProvider>
  );
  expect(screen.getByRole("article")).toHaveTextContent("Nombre");
  expect(screen.getByRole("link", { name: "Ver detalle" })).toHaveAttribute(
    "href",
    "/detalle"
  );
  expect(screen.getAllByRole("list").length).toBeGreaterThan(1);
});

it("renders configured public static organisms", () => {
  render(
    <>
      <CompanyCta
        title="Empresa"
        copy="Texto"
        href="mailto:test@example.test"
        label="Contactar"
      />
      <LocationSection title="Ubicación" />
      <FinalCta title="Final" copy="Texto" href="/reservar" label="Reservar" />
      <WhatsAppContact href="https://example.test/message" label="Mensaje" />
      <PublicFooter
        brandDescription="Descripción"
        copyright="Derechos"
        socials={[]}
        navigation={[]}
        contacts={[
          {
            id: "phone",
            href: "tel:+56000000000",
            icon: "Phone",
            label: "Teléfono",
          },
        ]}
        whatsapp={{
          description: "Escribe por WhatsApp.",
          href: "https://example.test/message",
          icon: "MessageCircle",
          label: "WhatsApp",
        }}
      />
    </>
  );
  expect(screen.getByRole("contentinfo")).toHaveTextContent("Descripción");
  expect(screen.getByRole("link", { name: "Reservar ahora" })).toHaveAttribute(
    "href",
    "#consulta-disponibilidad"
  );
  expect(screen.getByRole("link", { name: "Mensaje" })).toBeVisible();
});
