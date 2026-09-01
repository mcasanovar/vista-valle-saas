import "server-only";

import type { ReservationOrigin } from "@/features/reservations";

import type { PayAtPropertyConfirmationEmailData } from "./email-templates";
import type { CompanyQuotationEmailData } from "./email-templates";

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatClp(amount: number) {
  return `CLP ${new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function reservationDetails(
  data: Omit<PayAtPropertyConfirmationEmailData, "contactEmail">
) {
  const items = (
    data.items ?? [{ roomName: data.roomName, subtotalClp: data.totalClp }]
  )
    .map(
      (item) =>
        `<li>${escapeHtml(item.roomName)} — ${escapeHtml(formatClp(item.subtotalClp))}</li>`
    )
    .join("");
  return `<dl><div><dt>Reserva</dt><dd>${escapeHtml(data.publicId)}</dd></div><div><dt>Entrada</dt><dd>${escapeHtml(data.checkIn)}</dd></div><div><dt>Salida</dt><dd>${escapeHtml(data.checkOut)}</dd></div><div><dt>Noches</dt><dd>${escapeHtml(data.nights)}</dd></div><div><dt>Total</dt><dd>${escapeHtml(formatClp(data.totalClp))}</dd></div></dl><ul>${items}</ul>`;
}

function document(body: string) {
  return `<!doctype html><html lang="es"><body>${body}</body></html>`;
}

/**
 * Server-only serialization used by the delivery worker. It deliberately
 * mirrors the React template content without importing react-dom/server into
 * an App Route Handler graph.
 */
export function renderPayAtPropertyConfirmationEmail(
  data: PayAtPropertyConfirmationEmailData
) {
  return document(
    `<h1>Reserva confirmada</h1><p>Tu reserva está confirmada. El pago queda pendiente y se realiza al llegar a Vista Valle.</p>${reservationDetails(data)}<p>Modalidad: pagar al llegar.</p><p>Contacto: ${escapeHtml(data.contactEmail)}</p>`
  );
}

export function renderNewReservationAdminAlertEmail(
  data: PayAtPropertyConfirmationEmailData &
    Readonly<{ origin: ReservationOrigin }>
) {
  const origin = data.origin === "website" ? "Sitio web" : data.origin;
  const channelChecklist =
    data.origin === "website"
      ? "<p>Pendiente operativo: bloquear las fechas en Airbnb y Booking.</p>"
      : "";

  return document(
    `<h1>Nueva reserva confirmada</h1>${reservationDetails(data)}<p>Origen: ${escapeHtml(origin)}</p><p>Modalidad: pagar al llegar; pago pendiente.</p>${channelChecklist}<p>Contacto operativo: ${escapeHtml(data.contactEmail)}</p>`
  );
}

export function renderPaymentCollectedAdminEmail(reservationId: string) {
  return document(
    `<p>Se registró un cobro presencial para la reserva ${escapeHtml(reservationId)}.</p>`
  );
}

function quotationCoverageNotice(data: CompanyQuotationEmailData) {
  if (data.capacity >= data.guestCount) return "";
  return `<p><strong>Cobertura parcial:</strong> esta cotización cubre a ${escapeHtml(data.capacity)} de las ${escapeHtml(data.guestCount)} personas solicitadas.</p>`;
}

function quotationLines(data: CompanyQuotationEmailData) {
  return data.lines
    .map(
      (line) =>
        `<li>${escapeHtml(line.quantity)} × ${escapeHtml(line.name)} — ${escapeHtml(formatClp(line.nightlyPriceClp))} por noche — subtotal ${escapeHtml(formatClp(line.subtotalClp))}</li>`
    )
    .join("");
}

export function renderCompanyQuotationCustomerEmail(
  data: CompanyQuotationEmailData
) {
  return document(
    `<h1>Tu cotización de Vista Valle</h1><p>Hemos preparado la cotización solicitada con los datos ingresados.</p><dl><div><dt>Entrada</dt><dd>${escapeHtml(data.checkIn)}</dd></div><div><dt>Salida</dt><dd>${escapeHtml(data.checkOut)}</dd></div><div><dt>Personas</dt><dd>${escapeHtml(data.guestCount)}</dd></div></dl>${quotationCoverageNotice(data)}<ul>${quotationLines(data)}</ul><p>Noches: ${escapeHtml(data.nights)}</p><p>Total: <strong>${escapeHtml(formatClp(data.totalClp))}</strong></p>`
  );
}

export function renderCompanyQuotationAdminEmail(
  data: CompanyQuotationEmailData
) {
  return document(
    `<h1>Nueva cotización empresarial</h1><dl><div><dt>Empresa</dt><dd>${escapeHtml(data.company)}</dd></div><div><dt>Contacto</dt><dd>${escapeHtml(data.contact)}</dd></div><div><dt>Correo</dt><dd>${escapeHtml(data.email)}</dd></div><div><dt>Teléfono</dt><dd>${escapeHtml(data.phone || "No informado")}</dd></div><div><dt>Entrada</dt><dd>${escapeHtml(data.checkIn)}</dd></div><div><dt>Salida</dt><dd>${escapeHtml(data.checkOut)}</dd></div><div><dt>Personas</dt><dd>${escapeHtml(data.guestCount)}</dd></div></dl>${quotationCoverageNotice(data)}<p>Requisitos: ${escapeHtml(data.requirements)}</p><p>Mensaje: ${escapeHtml(data.message)}</p><ul>${quotationLines(data)}</ul><p>Noches: ${escapeHtml(data.nights)}</p><p>Total: <strong>${escapeHtml(formatClp(data.totalClp))}</strong></p>`
  );
}
