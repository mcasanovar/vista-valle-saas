import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { createCompanyEnquiryPath } from "@/features/company-enquiries";
import { PublicHomeTemplate } from "@/presentation/templates";

describe("company enquiry path", () => {
  it("exposes the dedicated quotation CTA without embedding the form", () => {
    render(<PublicHomeTemplate companyEnquiry={{ kind: "demo" }} rooms={[]} />);

    expect(
      screen.getByRole("link", { name: "Solicitar cotización" })
    ).toHaveAttribute("href", "/cotizacion-empresa");
    expect(
      screen.queryByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).not.toBeInTheDocument();
  });

  it("keeps the form unavailable in production and returns pending without a configured channel", async () => {
    expect(createCompanyEnquiryPath("production")).toEqual({ kind: "pending" });
    expect(
      createCompanyEnquiryPath("production", {
        href: "mailto:contacto@example.test",
        label: "Contactar",
      })
    ).toEqual({
      kind: "contact",
      contact: {
        href: "mailto:contacto@example.test",
        label: "Contactar",
      },
    });

    render(
      <PublicHomeTemplate companyEnquiry={{ kind: "pending" }} rooms={[]} />
    );

    expect(
      screen.queryByRole("form", {
        name: "Formulario de consulta para empresas de demostración",
      })
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText("Canal de contacto pendiente de configuración.")
      ).toBeVisible()
    );
  });
});
