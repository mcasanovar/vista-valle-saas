import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const router = { refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => router,
}));

import { AdminShell } from "@/features/admin/admin-shell";

describe("admin logout", () => {
  it("always takes the operator to the fixed login route after logout failure", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("provider unavailable");
      })
    );
    render(<AdminShell>Contenido</AdminShell>);
    await user.click(
      screen.getAllByRole("button", { name: "Cerrar sesión" })[0]!
    );
    expect(router.replace).toHaveBeenCalledWith("/admin/login");
    expect(router.refresh).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
