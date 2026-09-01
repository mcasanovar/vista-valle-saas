import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

import { AdminShell } from "@/features/admin/admin-shell";
import { authorizeAdministrator } from "@/infrastructure/auth/authorization";

describe("admin guard and dashboard boundaries", () => {
  it("rejects a missing session and accepts an allowlisted administrator", async () => {
    const missing = { session: { getSession: async () => null } } as never;
    await expect(
      authorizeAdministrator(missing, ["admin@example.com"])
    ).resolves.toMatchObject({ authorized: false });
    const allowed = {
      session: {
        getSession: async () => ({
          user: { email: "admin@example.com", role: "authenticated" },
        }),
      },
    } as never;
    await expect(
      authorizeAdministrator(allowed, ["admin@example.com"])
    ).resolves.toMatchObject({ authorized: true });
  });

  it("renders accessible admin navigation and skip link", () => {
    render(
      <AdminShell email="admin@example.com">
        <h1>Contenido</h1>
      </AdminShell>
    );
    expect(
      screen.getByRole("link", { name: "Saltar al contenido" })
    ).toHaveAttribute("href", "#admin-content");
    expect(
      screen.getByRole("navigation", { name: "Navegación administrativa" })
    ).toBeVisible();
    expect(
      screen
        .getAllByRole("link", { name: "Resumen" })
        .every((link) => link.getAttribute("aria-current") === "page")
    ).toBe(true);
  });
});
