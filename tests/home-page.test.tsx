import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import HomePage from "../app/page";

describe("HomePage", () => {
  it("composes the configured public conversion path without commercial placeholders", async () => {
    const user = userEvent.setup();
    render(await HomePage());

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Consulta de disponibilidad" })
      ).toBeVisible()
    );
    expect(
      screen.queryByText("Hospedaje en preparación")
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Descansa con una experiencia para recordar",
        })
      ).toBeVisible()
    );
    await waitFor(() =>
      expect(
        screen.getByRole("img", {
          name: "Fachada de Vista Valle con montañas nevadas al fondo",
        })
      ).toHaveAttribute("src", expect.stringContaining("bg-hero.jpg"))
    );
    expect(screen.getByText("Habitación Individual")).toBeVisible();
    expect(screen.getByText("Habitación Matrimonial")).toBeVisible();
    expect(screen.getByText("Habitación Doble")).toBeVisible();
    expect(screen.getByText(/55\.000/)).toBeVisible();

    for (const [label, href] of [
      ["Inicio", "#inicio"],
      ["Habitaciones", "/habitaciones"],
      ["Servicios", "#servicios"],
      ["Nosotros", "#nosotros"],
      ["Ubicación", "#ubicacion"],
      ["Contacto", "#contacto"],
      ["Reserva", "#consulta-disponibilidad"],
    ]) {
      expect(screen.getAllByRole("link", { name: label })[0]).toHaveAttribute(
        "href",
        href
      );
    }
    expect(
      screen.getAllByRole("link", { name: "Ver habitación" })[0]
    ).toHaveAttribute("href", "/habitaciones/habitacion-valle-demo");
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "Por qué elegir Vista Valle",
        })
      ).toBeVisible()
    );
    expect(screen.getByText("Vista privilegiada")).toBeVisible();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "Tu próxima estadía en Illapel comienza aquí",
        })
      ).toBeVisible()
    );
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );
    expect(
      screen.getByText("Revisa los campos marcados antes de continuar.")
    ).toBeVisible();
  });
});
