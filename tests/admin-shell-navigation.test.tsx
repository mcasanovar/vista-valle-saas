import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import { AdminShell } from "@/features/admin/admin-shell";

describe("AdminShell navigation", () => {
  it("shows the admin theme scope and the full section set in the desktop sidebar", () => {
    render(<AdminShell>Contenido</AdminShell>);
    const sidebar = screen.getByLabelText("Navegación administrativa");
    for (const label of [
      "Resumen",
      "Calendario",
      "Reservas",
      "Nueva reserva",
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
      "Bloqueos",
      "Sincronizaciones",
      "Asistente",
    ]) {
      expect(within(overflow).getByText(label)).toBeInTheDocument();
    }
  });

  it("shows all sections as icon-only links in the tablet rail", () => {
    render(<AdminShell>Contenido</AdminShell>);
    const rail = screen.getByLabelText("Navegación administrativa compacta");
    for (const label of [
      "Resumen",
      "Calendario",
      "Reservas",
      "Nueva reserva",
      "Bloqueos",
      "Sincronizaciones",
      "Alertas",
      "Asistente",
    ]) {
      expect(within(rail).getByLabelText(label)).toBeVisible();
    }
  });
});
