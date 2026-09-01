import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  NewReservationAdminAlertEmail,
  notificationEmailTemplateFixture,
  PayAtPropertyConfirmationEmail,
} from "@/features/notifications";

describe("notification email templates", () => {
  it("renders the complete pay-at-property guest confirmation with configured contact", () => {
    const html = renderToStaticMarkup(
      <PayAtPropertyConfirmationEmail {...notificationEmailTemplateFixture} />
    );

    expect(html).toContain("Reserva confirmada");
    expect(html).toContain("VV-DEMO-EMAIL");
    expect(html).toContain("Habitación de demostración");
    expect(html).toContain("2040-01-01");
    expect(html).toContain("2040-01-03");
    expect(html).toContain("CLP 120.000");
    expect(html).toContain("pagar al llegar");
    expect(html).toContain("pago queda pendiente");
    expect(html).toContain("contacto@example.test");
  });

  it("renders the website checklist only for website reservations", () => {
    const website = renderToStaticMarkup(
      <NewReservationAdminAlertEmail
        {...notificationEmailTemplateFixture}
        origin="website"
      />
    );
    const manual = renderToStaticMarkup(
      <NewReservationAdminAlertEmail
        {...notificationEmailTemplateFixture}
        origin="booking"
      />
    );

    expect(website).toContain("Origen: Sitio web");
    expect(website).toContain("Airbnb y Booking");
    expect(manual).toContain("Origen: booking");
    expect(manual).not.toContain("Airbnb y Booking");
  });

  it("never renders provider payloads, references, credentials, or tokens", () => {
    const html = renderToStaticMarkup(
      <NewReservationAdminAlertEmail
        {...notificationEmailTemplateFixture}
        origin="website"
      />
    );

    expect(html).not.toMatch(
      /token|secret|credential|externalReference|provider/i
    );
  });
});
