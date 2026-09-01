import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const router = { refresh: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { AdminLoginForm } from "@/features/admin/admin-login-form";

describe("admin login form", () => {
  it("uses native credential fields and keeps mock access separate from fake credentials", () => {
    const { rerender } = render(<AdminLoginForm context="production" />);
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute(
      "autocomplete",
      "email"
    );
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "type",
      "password"
    );
    rerender(<AdminLoginForm context="mock" />);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir panel de desarrollo" })
    ).toHaveAttribute("href", "/admin");
  });

  it("redirects only to the fixed panel route after a successful endpoint response", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
      )
    );
    render(<AdminLoginForm context="production" />);
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "admin@example.test"
    );
    await user.type(screen.getByLabelText("Contraseña"), "password");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(router.replace).toHaveBeenCalledWith("/admin");
    vi.unstubAllGlobals();
  });
});
