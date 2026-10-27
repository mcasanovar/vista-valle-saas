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

const monthNames = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/**
 * Formats a calendar date for a reader, never for a machine. It parses the
 * `YYYY-MM-DD` string by hand instead of going through `Date`, which would
 * reinterpret it in the server's time zone and can shift it by a day.
 */
function formatLongDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const monthName = monthNames[Number(month) - 1];
  if (!monthName) return value;
  return `${Number(day)} de ${monthName} de ${year}`;
}

function guestCountLabel(guestCount: number) {
  return `${guestCount} ${guestCount === 1 ? "persona" : "personas"}`;
}

/** The reservation code, which is what a guest is asked for on arrival. */
function reservationCode(publicId: string) {
  return `<tr><td style="padding:8px 24px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f1eb;border-left:4px solid #9a6b22"><tr><td style="padding:14px 16px;font:12px Arial,sans-serif;color:#665b52;letter-spacing:.08em;text-transform:uppercase">Código de reserva<br /><strong style="font:700 18px Georgia,serif;color:#211c18;letter-spacing:0;text-transform:none">${escapeHtml(publicId)}</strong></td></tr></table></td></tr>`;
}

function reservationStaySummary(
  data: Omit<PayAtPropertyConfirmationEmailData, "contactEmail">
) {
  return `<tr><td style="padding:0 24px 8px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f1eb"><tr><td style="padding:12px;font:14px Arial,sans-serif"><strong>Entrada</strong><br />${escapeHtml(formatLongDate(data.checkIn))}</td><td style="padding:12px;font:14px Arial,sans-serif"><strong>Salida</strong><br />${escapeHtml(formatLongDate(data.checkOut))}</td></tr><tr><td style="padding:12px;font:14px Arial,sans-serif"><strong>Noches</strong><br />${escapeHtml(data.nights)}</td><td style="padding:12px;font:14px Arial,sans-serif"><strong>Huéspedes</strong><br />${escapeHtml(guestCountLabel(data.guestCount))}</td></tr></table></td></tr>`;
}

/**
 * One row per room. The room and its occupancy share a single cell so the
 * line reads as one sentence - "Cabaña Alerce — 2 personas" - in clients
 * that collapse table layout.
 */
function reservationRooms(
  data: Omit<PayAtPropertyConfirmationEmailData, "contactEmail">
) {
  const rows = (
    data.items ?? [{ roomName: data.roomName, subtotalClp: data.totalClp }]
  )
    .map(
      (item) =>
        `<tr><td style="padding:12px;border-bottom:1px solid #e7dfd5;font:14px Arial,sans-serif">${escapeHtml(item.roomName)}${
          item.guestCount === undefined
            ? ""
            : ` — ${escapeHtml(guestCountLabel(item.guestCount))}`
        }</td><td style="padding:12px;border-bottom:1px solid #e7dfd5;text-align:right;font:14px Arial,sans-serif">${escapeHtml(formatClp(item.subtotalClp))}</td></tr>`
    )
    .join("");
  return `<tr><td style="padding:8px 24px 16px"><table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse"><caption style="padding:0 0 10px;text-align:left;font:700 18px Georgia,serif;color:#211c18">Habitaciones</caption><thead><tr><th scope="col" style="padding:10px 12px;background:#211c18;color:#ffffff;text-align:left;font:12px Arial,sans-serif">Habitación</th><th scope="col" style="padding:10px 12px;background:#211c18;color:#ffffff;text-align:right;font:12px Arial,sans-serif">Subtotal</th></tr></thead><tbody>${rows}</tbody></table></td></tr><tr><td style="padding:0 24px 24px;text-align:right;color:#211c18"><span style="font:700 14px Arial,sans-serif">Total</span><br /><strong style="font:700 24px Georgia,serif;color:#9a6b22">${escapeHtml(formatClp(data.totalClp))}</strong></td></tr>`;
}

function paragraph(content: string) {
  return `<tr><td style="padding:8px 24px 16px;color:#3f352d;font:15px/1.55 Arial,sans-serif">${content}</td></tr>`;
}

function highlightNotice(content: string) {
  return `<tr><td style="padding:18px 24px;background:#fff4e5;border-top:4px solid #9a6b22;color:#4a3013;font:15px/1.55 Arial,sans-serif">${content}</td></tr>`;
}

function contactFooter(label: string, contactEmail: string) {
  return `<tr><td style="padding:20px 24px 28px;color:#665b52;font:13px/1.5 Arial,sans-serif">${escapeHtml(label)}: <a href="mailto:${escapeHtml(contactEmail)}" style="color:#9a6b22">${escapeHtml(contactEmail)}</a></td></tr>`;
}

function reservationBody(
  data: Omit<PayAtPropertyConfirmationEmailData, "contactEmail">
) {
  return `${reservationCode(data.publicId)}${reservationStaySummary(data)}${reservationRooms(data)}`;
}

/**
 * The charset declaration is not optional: without it a client that does not
 * trust the MIME header falls back to latin-1 and every accented character
 * in these Spanish templates renders as mojibake.
 */
function document(body: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body style="margin:0;padding:0;background:#f5f1eb">${body}</body></html>`;
}

/**
 * Server-only serialization used by the delivery worker. It deliberately
 * mirrors the React template content without importing react-dom/server into
 * an App Route Handler graph, and shares the branded shell with the company
 * quotation emails so every message the property sends looks like one voice.
 */
export function renderPayAtPropertyConfirmationEmail(
  data: PayAtPropertyConfirmationEmailData
) {
  return brandShell(
    "Reserva confirmada",
    `${paragraph(
      "Tu reserva está confirmada. El pago queda pendiente y se realiza al llegar a Vista Valle."
    )}${reservationBody(data)}${highlightNotice(
      "<strong>Modalidad:</strong> pagar al llegar. No necesitas transferir nada por adelantado; al llegar te recibimos con el código de reserva."
    )}${contactFooter("Cualquier duda, escríbenos a", data.contactEmail)}`
  );
}

export function renderNewReservationAdminAlertEmail(
  data: PayAtPropertyConfirmationEmailData &
    Readonly<{ origin: ReservationOrigin }>
) {
  const origin = data.origin === "website" ? "Sitio web" : data.origin;
  const channelChecklist =
    data.origin === "website"
      ? highlightNotice(
          "<strong>Pendiente operativo:</strong> bloquear las fechas en Airbnb y Booking."
        )
      : "";

  return brandShell(
    "Nueva reserva confirmada",
    `${paragraph(
      `<strong>Origen:</strong> ${escapeHtml(origin)}<br /><strong>Modalidad:</strong> pagar al llegar; pago pendiente.`
    )}${reservationBody(data)}${channelChecklist}${contactFooter(
      "Contacto operativo",
      data.contactEmail
    )}`
  );
}

/**
 * What changed in a stay edit, already resolved to room names by the
 * delivery worker so this renderer stays pure. `removedRooms` can only be
 * built from the pre-edit snapshot carried on the intent, since the
 * updated reservation no longer references those rooms.
 */
export type ReservationStayChangeEmailData = Readonly<{
  addedRooms: readonly Readonly<{ guestCount: number; roomName: string }>[];
  datesChanged: boolean;
  previousCheckIn: string;
  previousCheckOut: string;
  removedRooms: readonly Readonly<{ roomName: string }>[];
}>;

function stayChangeSummary(change: ReservationStayChangeEmailData) {
  const parts: string[] = [];
  if (change.datesChanged) {
    parts.push(
      `<li style="padding:0 0 6px">Fechas anteriores: ${escapeHtml(formatLongDate(change.previousCheckIn))} — ${escapeHtml(formatLongDate(change.previousCheckOut))}</li>`
    );
  }
  for (const room of change.addedRooms) {
    parts.push(
      `<li style="padding:0 0 6px">Habitación agregada: ${escapeHtml(room.roomName)} (${escapeHtml(guestCountLabel(room.guestCount))})</li>`
    );
  }
  for (const room of change.removedRooms) {
    parts.push(
      `<li style="padding:0 0 6px">Habitación quitada: ${escapeHtml(room.roomName)}</li>`
    );
  }
  if (parts.length === 0) return "";
  return `<tr><td style="padding:8px 24px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f1eb;border-left:4px solid #9a6b22"><tr><td style="padding:14px 16px;color:#211c18;font:14px/1.55 Arial,sans-serif"><strong style="display:block;padding:0 0 8px;font:700 16px Georgia,serif">Qué cambió</strong><ul style="margin:0;padding:0 0 0 18px">${parts.join("")}</ul></td></tr></table></td></tr>`;
}

/**
 * Administrative alert for a stay edit: dates, room set, and per-room
 * occupancy. Sent only to the configured administrative recipient - the
 * guest is never notified of a stay change.
 */
export function renderReservationDatesChangedAdminEmail(
  data: PayAtPropertyConfirmationEmailData,
  change?: ReservationStayChangeEmailData
) {
  return brandShell(
    "Estadía de reserva actualizada",
    `${paragraph(
      "Se modificó la estadía de una reserva. El resumen refleja el estado actual."
    )}${change ? stayChangeSummary(change) : ""}${reservationBody(data)}${contactFooter(
      "Contacto operativo",
      data.contactEmail
    )}`
  );
}

export function renderPaymentCollectedAdminEmail(reservationId: string) {
  return brandShell(
    "Cobro presencial registrado",
    paragraph(
      `Se registró un cobro presencial para la reserva ${escapeHtml(reservationId)}.`
    )
  );
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
  return `<tr><td style="padding:12px;border-bottom:1px solid #e7dfd5;font:14px Arial,sans-serif">${escapeHtml(data.breakfastQuantity ?? 0)} × Desayuno × ${escapeHtml(data.nights)} ${data.nights === 1 ? "noche" : "noches"}</td><td style="padding:12px;border-bottom:1px solid #e7dfd5;text-align:right;font:14px Arial,sans-serif">${escapeHtml(formatClp(data.breakfastUnitPriceClp ?? 0))}</td><td style="padding:12px;border-bottom:1px solid #e7dfd5;text-align:right;font:14px Arial,sans-serif">${escapeHtml(formatClp(data.breakfastSubtotalClp))}</td></tr>`;
}

function brandLogoUrl() {
  try {
    return new URL(
      "/brand/vista-valle-logo-white.png",
      getServerEnvironment().SITE_URL
    ).toString();
  } catch {
    return null;
  }
}

function brandShell(title: string, content: string) {
  const logoUrl = brandLogoUrl();
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
  return brandShell(
    "Tu cotización para empresas",
    `<tr><td style="padding:8px 24px 16px;color:#3f352d;font:15px/1.55 Arial,sans-serif">Hola ${escapeHtml(data.contact)}, hemos preparado el resumen de alojamiento solicitado.</td></tr>${quotationStaySummary(data)}${quotationParkingNotice(data)}${quotationPriceTable(data)}<tr><td style="padding:18px 24px;background:#fff4e5;border-top:4px solid #9a6b22;color:#4a3013;font:15px/1.55 Arial,sans-serif"><strong>IMPORTANTE:</strong> responde a este mismo correo confirmando los días cotizados para que podamos generar la reserva. Esta cotización no crea una reserva automáticamente.</td></tr><tr><td style="padding:20px 24px 28px;color:#665b52;font:13px/1.5 Arial,sans-serif">Este documento es una cotización de alojamiento y no confirma una reserva.</td></tr>`
  );
}

export function renderCompanyQuotationAdminEmail(
  data: CompanyQuotationEmailData
) {
  return brandShell(
    "Nueva cotización empresarial",
    `<tr><td style="padding:8px 24px 16px;color:#3f352d;font:15px/1.55 Arial,sans-serif">Revisa los datos y confirma operativamente los días antes de generar una reserva.</td></tr><tr><td style="padding:8px 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f1eb"><tr><td style="padding:12px;font:14px Arial,sans-serif"><strong>Empresa</strong><br />${escapeHtml(data.company)}</td><td style="padding:12px;font:14px Arial,sans-serif"><strong>Contacto</strong><br />${escapeHtml(data.contact)}</td></tr><tr><td style="padding:12px;font:14px Arial,sans-serif"><strong>Correo</strong><br />${escapeHtml(data.email)}</td><td style="padding:12px;font:14px Arial,sans-serif"><strong>Teléfono</strong><br />${escapeHtml(data.phone || "No informado")}</td></tr></table></td></tr>${quotationStaySummary(data)}<tr><td style="padding:8px 24px;color:#211c18;font:14px/1.55 Arial,sans-serif"><strong>Estacionamiento:</strong> ${data.requireParking ? "Sí" : "No"}</td></tr><tr><td style="padding:8px 24px 16px;color:#211c18;font:14px/1.55 Arial,sans-serif"><strong>Mensaje:</strong><br />${escapeHtml(data.message)}</td></tr>${quotationPriceTable(data)}<tr><td style="padding:20px 24px 28px;color:#665b52;font:13px/1.5 Arial,sans-serif">Esta cotización no es una reserva confirmada.</td></tr>`
  );
}
