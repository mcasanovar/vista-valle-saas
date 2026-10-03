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

  it("disables the button and shows a busy state while the request is in flight, and ignores a second click", async () => {
    const user = userEvent.setup();
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<AdminLoginForm context="production" />);
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "admin@example.test"
    );
    await user.type(screen.getByLabelText("Contraseña"), "password");

    const button = screen.getByRole("button", { name: "Ingresar" });
    await user.click(button);

    const busyButton = await screen.findByRole("button", {
      name: "Ingresando…",
    });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute("aria-busy", "true");

    // A second click while the request is still pending must not fire a
    // second request - the button is both disabled and guarded in code.
    await user.click(busyButton);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await screen.findByRole("button", { name: "Ingresar" });
    vi.unstubAllGlobals();
  });

  it("re-enables the button without the busy state after a failed login", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ ok: false }), { status: 401 })
      )
    );
    render(<AdminLoginForm context="production" />);
    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "admin@example.test"
    );
    await user.type(screen.getByLabelText("Contraseña"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    const button = await screen.findByRole("button", { name: "Ingresar" });
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "false");
    vi.unstubAllGlobals();
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
