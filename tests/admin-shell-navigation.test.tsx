import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/admin" } }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import { AdminShell } from "@/features/admin/admin-shell";

afterEach(() => {
  pathname.current = "/admin";
});

describe("AdminShell navigation", () => {
  it("shows the admin theme scope and the full section set in the desktop sidebar", () => {
    render(<AdminShell>Contenido</AdminShell>);
    const sidebar = screen.getByLabelText("Navegación administrativa");
    for (const label of [
      "Resumen",
      "Calendario",
      "Reservas",
      "Nueva reserva",
      "Cotizaciones",
      "Bloqueos",
      "Sincronizaciones",
      "Alertas",
      "Asistente",
    ]) {
      expect(within(sidebar).getByText(label)).toBeVisible();
    }
  });

  it("wraps the shell in the isolated admin theme scope", () => {
    const { container } = render(<AdminShell>Contenido</AdminShell>);
    expect(container.querySelector('[data-theme="admin"]')).not.toBeNull();
  });

  it("limits the mobile bottom nav to Resumen, Calendario, Reservas and Alertas, with the rest under Más", () => {
    render(<AdminShell>Contenido</AdminShell>);
    const mobileNav = screen.getByLabelText("Navegación administrativa móvil");
    const overflow = within(mobileNav).getByLabelText(
      "Más secciones administrativas"
    ).parentElement!;

    const directLinks = within(mobileNav)
      .getAllByRole("link")
      .filter((link) => !overflow.contains(link));
    expect(directLinks.map((link) => link.textContent)).toEqual([
      "Resumen",
      "Calendario",
      "Reservas",
      "Alertas",
    ]);
    expect(within(mobileNav).getByText("Más")).toBeVisible();

    // The overflow panel lives inside a closed <details>, so its links exist
    // in the DOM but are not visible until the disclosure is opened.
    for (const label of [
      "Nueva reserva",
      "Cotizaciones",
      "Bloqueos",
      "Sincronizaciones",
      "Asistente",
    ]) {
      expect(within(overflow).getByText(label)).toBeInTheDocument();
    }
  });

  it("marks Cotizaciones as the current section on its listing and detail routes, without also marking Reservas", () => {
    for (const path of [
      "/admin/cotizaciones",
      "/admin/cotizaciones/8f1c6f54-0c38-4a1e-9f1a-9b0f2d5a7c11",
    ]) {
      pathname.current = path;
      const { unmount } = render(<AdminShell>Contenido</AdminShell>);
      const sidebar = screen.getByLabelText("Navegación administrativa");

      expect(
        within(sidebar).getByText("Cotizaciones").closest("a")
      ).toHaveAttribute("aria-current", "page");
      expect(
        within(sidebar).getByText("Reservas").closest("a")
      ).not.toHaveAttribute("aria-current");
      unmount();
    }
  });

  it("keeps Reservas current on its own routes once Cotizaciones exists", () => {
    pathname.current = "/admin/reservas/8f1c6f54-0c38-4a1e-9f1a-9b0f2d5a7c11";
    render(<AdminShell>Contenido</AdminShell>);
    const sidebar = screen.getByLabelText("Navegación administrativa");

    expect(within(sidebar).getByText("Reservas").closest("a")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(
      within(sidebar).getByText("Cotizaciones").closest("a")
    ).not.toHaveAttribute("aria-current");
  });

  it("shows all sections as icon-only links in the tablet rail", () => {
    render(<AdminShell>Contenido</AdminShell>);
    const rail = screen.getByLabelText("Navegación administrativa compacta");
    for (const label of [
      "Resumen",
      "Calendario",
      "Reservas",
      "Nueva reserva",
      "Cotizaciones",
      "Bloqueos",
      "Sincronizaciones",
      "Alertas",
      "Asistente",
    ]) {
      expect(within(rail).getByLabelText(label)).toBeVisible();
    }
  });
});
