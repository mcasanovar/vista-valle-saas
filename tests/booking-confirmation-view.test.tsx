import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BookingConfirmationView } from "@/features/reservations";

describe("BookingConfirmationView", () => {
  it("shows only the allowed confirmation details and pending payment message", () => {
    render(
      <BookingConfirmationView
        confirmation={{
          checkIn: "2027-01-10",
          checkOut: "2027-01-13",
          guest: { firstName: "Ana" },
          guestCount: 2,
          nights: 3,
          paymentMode: "PAY_AT_PROPERTY",
          publicId: "VV-12345678-1234-1234-1234-123456789abc",
          room: { name: "Habitación Valle" },
          totalClp: 165000,
        }}
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Reserva confirmada");
    expect(screen.getByText("Pagar al llegar")).toBeVisible();
    expect(screen.getByText("$165.000")).toBeVisible();
    expect(screen.queryByText("ana@example.com")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Tu pago permanece pendiente y se realizará al llegar a Vista Valle."
      )
    ).toBeVisible();
  });

  it("hides the pending-payment message and shows the paid total for an online Fintoc payment", () => {
    render(
      <BookingConfirmationView
        confirmation={{
          checkIn: "2027-01-10",
          checkOut: "2027-01-13",
          guest: { firstName: "Ana" },
          guestCount: 2,
          nights: 3,
          paymentMode: "PAY_NOW",
          publicId: "VV-12345678-1234-1234-1234-123456789abc",
          room: { name: "Habitación Valle" },
          totalClp: 165000,
        }}
      />
    );

    expect(screen.getByText("Pagado en línea con Fintoc")).toBeVisible();
    expect(screen.getByText("Total pagado")).toBeVisible();
    expect(
      screen.queryByText(
        "Tu pago permanece pendiente y se realizará al llegar a Vista Valle."
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Total pendiente")).not.toBeInTheDocument();
  });
});
