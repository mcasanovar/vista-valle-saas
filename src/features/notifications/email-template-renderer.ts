import "server-only";

import { getServerEnvironment } from "@/config/server";
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
  return `<tr><td style="padding:16px 24px;background:#fff4e5;color:#6b3f12;font:14px/1.5 Arial,sans-serif"><strong>Cobertura parcial:</strong> esta cotización cubre a ${escapeHtml(data.capacity)} de las ${escapeHtml(data.guestCount)} personas solicitadas.</td></tr>`;
}

function quotationLines(data: CompanyQuotationEmailData) {
  return data.lines
    .map(
      (line) =>
        `<tr><td style="padding:12px;border-bottom:1px solid #e7dfd5;font:14px Arial,sans-serif">${escapeHtml(line.quantity)} × ${escapeHtml(line.name)}</td><td style="padding:12px;border-bottom:1px solid #e7dfd5;text-align:right;font:14px Arial,sans-serif">${escapeHtml(formatClp(line.nightlyPriceClp))}</td><td style="padding:12px;border-bottom:1px solid #e7dfd5;text-align:right;font:14px Arial,sans-serif">${escapeHtml(formatClp(line.subtotalClp))}</td></tr>`
    )
    .join("");
}

function quotationBreakfastRow(data: CompanyQuotationEmailData) {
  if (!data.breakfastRequested) return "";
  return `<tr><td style="padding:12px;border-bottom:1px solid #e7dfd5;font:14px Arial,sans-serif">${escapeHtml(data.breakfastQuantity ?? 0)} × Desayuno</td><td style="padding:12px;border-bottom:1px solid #e7dfd5;text-align:right;font:14px Arial,sans-serif">${escapeHtml(formatClp(data.breakfastUnitPriceClp ?? 0))}</td><td style="padding:12px;border-bottom:1px solid #e7dfd5;text-align:right;font:14px Arial,sans-serif">${escapeHtml(formatClp(data.breakfastSubtotalClp))}</td></tr>`;
}

function quotationLogoUrl() {
  try {
    return new URL(
      "/brand/vista-valle-logo-white.png",
      getServerEnvironment().SITE_URL
    ).toString();
  } catch {
    return null;
  }
}

function quotationShell(title: string, content: string) {
  const logoUrl = quotationLogoUrl();
  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="52" height="52" alt="Vista Valle Lodging House" style="display:block;width:52px;height:52px;border:0;outline:none;text-decoration:none" />`
    : `<span style="font:700 20px Georgia,serif;color:#ffffff">Vista Valle Lodging House</span>`;
  return document(
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0;background:#f5f1eb"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff"><tr><td style="padding:24px;background:#211c18;text-align:center">${logo}<p style="margin:10px 0 0;color:#ffffff;font:700 20px Georgia,serif">Vista Valle Lodging House</p></td></tr><tr><td style="padding:28px 24px 8px;color:#211c18"><h1 style="margin:0;font:700 26px/1.25 Georgia,serif">${escapeHtml(title)}</h1></td></tr>${content}</table></td></tr></table>`
  );
}

function quotationStaySummary(data: CompanyQuotationEmailData) {
  return `<tr><td style="padding:16px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f1eb"><tr><td style="padding:12px;font:14px Arial,sans-serif"><strong>Entrada</strong><br />${escapeHtml(data.checkIn)}</td><td style="padding:12px;font:14px Arial,sans-serif"><strong>Salida</strong><br />${escapeHtml(data.checkOut)}</td></tr><tr><td style="padding:12px;font:14px Arial,sans-serif"><strong>Noches</strong><br />${escapeHtml(data.nights)}</td><td style="padding:12px;font:14px Arial,sans-serif"><strong>Personas</strong><br />${escapeHtml(data.guestCount)}</td></tr></table></td></tr>`;
}

function quotationParkingNotice(data: CompanyQuotationEmailData) {
  return `<tr><td style="padding:0 24px 8px;color:#211c18;font:14px/1.55 Arial,sans-serif"><strong>Estacionamiento:</strong> ${data.requireParking ? "Sí" : "No"}</td></tr>`;
}

function quotationPriceTable(data: CompanyQuotationEmailData) {
  return `<tr><td style="padding:8px 24px 24px"><table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse"><caption style="padding:0 0 10px;text-align:left;font:700 18px Georgia,serif;color:#211c18">Habitaciones cotizadas</caption><thead><tr><th scope="col" style="padding:10px 12px;background:#211c18;color:#ffffff;text-align:left;font:12px Arial,sans-serif">Habitación</th><th scope="col" style="padding:10px 12px;background:#211c18;color:#ffffff;text-align:right;font:12px Arial,sans-serif">Precio / noche</th><th scope="col" style="padding:10px 12px;background:#211c18;color:#ffffff;text-align:right;font:12px Arial,sans-serif">Subtotal</th></tr></thead><tbody>${quotationLines(data)}${quotationBreakfastRow(data)}</tbody></table></td></tr><tr><td style="padding:0 24px 28px;text-align:right;color:#211c18"><span style="font:700 14px Arial,sans-serif">Total estimado</span><br /><strong style="font:700 24px Georgia,serif;color:#9a6b22">${escapeHtml(formatClp(data.totalClp))}</strong></td></tr>`;
}

export function renderCompanyQuotationCustomerEmail(
  data: CompanyQuotationEmailData
) {
  return quotationShell(
    "Tu cotización para empresas",
    `<tr><td style="padding:8px 24px 16px;color:#3f352d;font:15px/1.55 Arial,sans-serif">Hola ${escapeHtml(data.contact)}, hemos preparado el resumen de alojamiento solicitado.</td></tr>${quotationStaySummary(data)}${quotationCoverageNotice(data)}${quotationParkingNotice(data)}${quotationPriceTable(data)}<tr><td style="padding:18px 24px;background:#fff4e5;border-top:4px solid #9a6b22;color:#4a3013;font:15px/1.55 Arial,sans-serif"><strong>IMPORTANTE:</strong> responde a este mismo correo confirmando los días cotizados para que podamos generar la reserva. Esta cotización no crea una reserva automáticamente.</td></tr><tr><td style="padding:20px 24px 28px;color:#665b52;font:13px/1.5 Arial,sans-serif">Este documento es una cotización de alojamiento y no confirma una reserva.</td></tr>`
  );
}

export function renderCompanyQuotationAdminEmail(
  data: CompanyQuotationEmailData
) {
  return quotationShell(
    "Nueva cotización empresarial",
    `<tr><td style="padding:8px 24px 16px;color:#3f352d;font:15px/1.55 Arial,sans-serif">Revisa los datos y confirma operativamente los días antes de generar una reserva.</td></tr><tr><td style="padding:8px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f1eb"><tr><td style="padding:12px;font:14px Arial,sans-serif"><strong>Empresa</strong><br />${escapeHtml(data.company)}</td><td style="padding:12px;font:14px Arial,sans-serif"><strong>Contacto</strong><br />${escapeHtml(data.contact)}</td></tr><tr><td style="padding:12px;font:14px Arial,sans-serif"><strong>Correo</strong><br />${escapeHtml(data.email)}</td><td style="padding:12px;font:14px Arial,sans-serif"><strong>Teléfono</strong><br />${escapeHtml(data.phone || "No informado")}</td></tr></table></td></tr>${quotationStaySummary(data)}${quotationCoverageNotice(data)}<tr><td style="padding:8px 24px;color:#211c18;font:14px/1.55 Arial,sans-serif"><strong>Estacionamiento:</strong> ${data.requireParking ? "Sí" : "No"}</td></tr><tr><td style="padding:8px 24px 16px;color:#211c18;font:14px/1.55 Arial,sans-serif"><strong>Mensaje:</strong><br />${escapeHtml(data.message)}</td></tr>${quotationPriceTable(data)}<tr><td style="padding:20px 24px 28px;color:#665b52;font:13px/1.5 Arial,sans-serif">Esta cotización no es una reserva confirmada.</td></tr>`
  );
}
