import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import CompanyQuotationDetail from "../app/(admin-protected)/admin/cotizaciones/[id]/page";
import CompanyQuotationsPage from "../app/(admin-protected)/admin/cotizaciones/page";

describe("admin company quotations pages", () => {
  it("shows an explicit unavailable message outside production, instead of falling back to mock data", async () => {
    render(await CompanyQuotationsPage({ searchParams: Promise.resolve({}) }));
    expect(
      await screen.findByText("Las cotizaciones no están disponibles.")
    ).toBeVisible();
  });

  it("shows the detail as unavailable outside production", async () => {
    render(
      await CompanyQuotationDetail({
        params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }),
      })
    );
    expect(
      await screen.findByText("Cotización no disponible.")
    ).toBeVisible();
  });
});
