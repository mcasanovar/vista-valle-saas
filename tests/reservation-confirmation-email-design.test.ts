import { describe, expect, it } from "vitest";

import {
  renderNewReservationAdminAlertEmail,
  renderPayAtPropertyConfirmationEmail,
} from "@/features/notifications/email-template-renderer";

const data = {
  checkIn: "2033-11-18",
  checkOut: "2033-11-21",
  contactEmail: "contacto@example.test",
  guestCount: 3,
  items: [
    {
      guestCount: 1,
      roomId: "room-a",
      roomName: "Departamento interior",
      subtotalClp: 126_000,
    },
    {
      guestCount: 2,
      roomId: "room-b",
      roomName: "Habitación matrimonial",
      subtotalClp: 165_000,
    },
  ],
  nights: 3,
  publicId: "VV-DESIGN-EMAIL",
  roomName: "Departamento interior",
  totalClp: 291_000,
} as const;

describe("reservation confirmation email presentation", () => {
  it("declares its encoding so accented Spanish survives every client", () => {
    const html = renderPayAtPropertyConfirmationEmail(data);

    expect(html).toContain('<meta charset="utf-8" />');
    expect(html).toContain("Habitación matrimonial");
  });

  it("wears the same branded shell as the quotation emails", () => {
    const html = renderPayAtPropertyConfirmationEmail(data);

    expect(html).toContain("Vista Valle Lodging House");
    // The shell is a max-width table on the brand's sand background, which
    // is what makes the message read as a designed email rather than as
    // bare markup.
    expect(html).toContain("max-width:640px");
    expect(html).toContain("background:#f5f1eb");
  });

  it("spells dates out for the reader instead of printing ISO strings", () => {
    const html = renderPayAtPropertyConfirmationEmail(data);

    expect(html).toContain("18 de noviembre de 2033");
    expect(html).toContain("21 de noviembre de 2033");
    expect(html).not.toContain("2033-11-18");
  });

  it("states the code, the rooms with their occupancy, and the total", () => {
    const html = renderPayAtPropertyConfirmationEmail(data);

    expect(html).toContain("VV-DESIGN-EMAIL");
    expect(html).toContain("Departamento interior — 1 persona");
    expect(html).toContain("Habitación matrimonial — 2 personas");
    expect(html).toContain("CLP 291.000");
    expect(html).toContain("pagar al llegar");
  });

  it("keeps the administrative copy branded and operational", () => {
    const html = renderNewReservationAdminAlertEmail({
      ...data,
      origin: "website",
    });

    expect(html).toContain("Nueva reserva confirmada");
    expect(html).toContain("Origen:");
    expect(html).toContain("Sitio web");
    expect(html).toContain("Airbnb y Booking");
    expect(html).toContain("18 de noviembre de 2033");
    expect(html).not.toMatch(
      /token|secret|credential|externalReference|provider/i
    );
  });

  it("leaves an unparseable date untouched rather than inventing one", () => {
    const html = renderPayAtPropertyConfirmationEmail({
      ...data,
      checkIn: "sin fecha",
    });

    expect(html).toContain("sin fecha");
  });
});
