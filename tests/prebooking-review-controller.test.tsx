import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () =>
    new URLSearchParams(
      "checkIn=2032-02-10&checkOut=2032-02-13&guests=1&rooms=valle,andes"
    ),
}));

import { PrebookingReviewController } from "@/features/reservations";

describe("PrebookingReviewController", () => {
  afterEach(() => {
    router.replace.mockClear();
  });

  it("renders authoritative item subtotals and lets the guest remove an item", () => {
    render(
      <PrebookingReviewController
        review={{
          kind: "ready",
          checkIn: "2032-02-10",
          checkOut: "2032-02-13",
          guests: 1,
          nights: 3,
          rooms: [
            {
              id: "1",
              name: "Valle",
              nightlyPriceClp: 55_000,
              slug: "valle",
              subtotalClp: 165_000,
            },
            {
              id: "2",
              name: "Andes",
              nightlyPriceClp: 60_000,
              slug: "andes",
              subtotalClp: 180_000,
            },
          ],
          totalClp: 345_000,
        }}
        bookingEnabled
      />
    );

    expect(screen.getByText("$345.000")).toBeVisible();
    expect(screen.getByLabelText("Solicitar factura")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Quitar Andes de la reserva" })
    );
    expect(router.replace).toHaveBeenCalledWith(
      "/pre-reserva?checkIn=2032-02-10&checkOut=2032-02-13&guests=1&rooms=valle",
      { scroll: false }
    );
  });

  it("presents dates as a read-only semantic summary without edit controls", () => {
    render(
      <PrebookingReviewController
        review={{
          kind: "ready",
          checkIn: "2032-02-10",
          checkOut: "2032-02-13",
          guests: 1,
          nights: 3,
          rooms: [
            {
              id: "1",
              name: "Valle",
              nightlyPriceClp: 55_000,
              slug: "valle",
              subtotalClp: 165_000,
            },
          ],
          totalClp: 165_000,
        }}
        bookingEnabled
      />
    );

    const review = screen.getByRole("main");
    const dateSummary = screen.getByLabelText("Fechas de la reserva");
    const guestForm = screen.getByRole("form", { name: "Datos del huésped" });

    expect(dateSummary.tagName).toBe("SECTION");
    expect(dateSummary).toHaveTextContent("Entrada");
    expect(dateSummary).toHaveTextContent("10 de febrero de 2032");
    expect(dateSummary).toHaveTextContent("Salida");
    expect(dateSummary).toHaveTextContent("13 de febrero de 2032");
    expect(dateSummary).toHaveClass("bg-card", "shadow-md");
    expect(review).toHaveClass("min-h-dvh", "bg-warm");
    expect(guestForm).toHaveClass("bg-card", "shadow-md");
    expect(
      screen.getByText("Tu estadía").parentElement?.parentElement
    ).toHaveClass("bg-reservation-total", "shadow-md");
    expect(
      [...review.querySelectorAll<HTMLElement>("*")].some((element) =>
        element.getAttribute("class")?.includes("bg-[#")
      )
    ).toBe(false);
    expect(
      screen.queryByRole("textbox", { name: /Entrada|Salida/ })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /actualizar|editar.*fecha/i })
    ).toBeNull();
  });
});
