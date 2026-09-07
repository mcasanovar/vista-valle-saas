import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/ubicacion",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/presentation/organisms", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/presentation/organisms")>();
  return {
    ...actual,
    LocationMapLoader: ({
      hostal,
      plazaDeArmas,
    }: {
      hostal: { label: string };
      plazaDeArmas: { label: string };
    }) => (
      <div data-testid="location-map">
        <span>{hostal.label}</span>
        <span>{plazaDeArmas.label}</span>
      </div>
    ),
  };
});

import { publicSiteContent } from "@/config/public-site-content";
import { LocationTemplate } from "@/presentation/templates";

describe("LocationTemplate", () => {
  it("shows the hostal and Plaza de Armas markers, city/transport copy, and a nav pointing to /ubicacion", () => {
    render(<LocationTemplate />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Ubicación" })
    ).toBeVisible();

    const map = screen.getByTestId("location-map");
    expect(map).toHaveTextContent(publicSiteContent.location.hostal.label);
    expect(
      map
    ).toHaveTextContent(publicSiteContent.location.plazaDeArmas.label);

    expect(
      screen.getByText(publicSiteContent.location.cityInfo)
    ).toBeVisible();
    expect(
      screen.getByText(publicSiteContent.location.transportInfo)
    ).toBeVisible();

    expect(
      screen.getAllByRole("link", { name: "Ubicación" })[0]
    ).toHaveAttribute("href", "/ubicacion");
  });
});
