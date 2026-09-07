import "server-only";

import type { ReservationOrigin } from "@/features/reservations";
import type { CompanyQuotationRecord } from "@/features/company-quotations";

export type PayAtPropertyConfirmationEmailData = Readonly<{
  checkIn: string;
  checkOut: string;
  contactEmail: string;
  guestCount: number;
  nights: number;
  publicId: string;
  roomName: string;
  items?: readonly Readonly<{ roomName: string; subtotalClp: number }>[];
  totalClp: number;
}>;

export type NewReservationAdminAlertEmailData =
  PayAtPropertyConfirmationEmailData &
    Readonly<{
      origin: ReservationOrigin;
    }>;

export type CompanyQuotationEmailData = CompanyQuotationRecord;

function formatClp(amount: number) {
  return `CLP ${new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

function ReservationDetails({
  checkIn,
  checkOut,
  guestCount,
  nights,
  publicId,
  roomName,
  totalClp,
}: Omit<PayAtPropertyConfirmationEmailData, "contactEmail">) {
  return (
    <dl>
      <div>
        <dt>Reserva</dt>
        <dd>{publicId}</dd>
      </div>
      <div>
        <dt>Habitación</dt>
        <dd>{roomName}</dd>
      </div>
      <div>
        <dt>Entrada</dt>
        <dd>{checkIn}</dd>
      </div>
      <div>
        <dt>Salida</dt>
        <dd>{checkOut}</dd>
      </div>
      <div>
        <dt>Noches</dt>
        <dd>{nights}</dd>
      </div>
      <div>
        <dt>Huéspedes</dt>
        <dd>{guestCount}</dd>
      </div>
      <div>
        <dt>Total</dt>
        <dd>{formatClp(totalClp)}</dd>
      </div>
    </dl>
  );
}

/** Server-only template contract; a delivery adapter renders it later. */
export function PayAtPropertyConfirmationEmail(
  props: PayAtPropertyConfirmationEmailData
) {
  return (
    <html lang="es">
      <body>
        <h1>Reserva confirmada</h1>
        <p>
          Tu reserva está confirmada. El pago queda pendiente y se realiza al
          llegar a Vista Valle.
        </p>
        <ReservationDetails {...props} />
        <p>Modalidad: pagar al llegar.</p>
        <p>Contacto: {props.contactEmail}</p>
      </body>
    </html>
  );
}

function formatOrigin(origin: ReservationOrigin) {
  return origin === "website" ? "Sitio web" : origin;
}

/** Server-only operational alert without payment-provider or guest details. */
export function NewReservationAdminAlertEmail(
  props: NewReservationAdminAlertEmailData
) {
  return (
    <html lang="es">
      <body>
        <h1>Nueva reserva confirmada</h1>
        <ReservationDetails {...props} />
        <p>Origen: {formatOrigin(props.origin)}</p>
        <p>Modalidad: pagar al llegar; pago pendiente.</p>
        {props.origin === "website" ? (
          <p>Pendiente operativo: bloquear las fechas en Airbnb y Booking.</p>
        ) : null}
        <p>Contacto operativo: {props.contactEmail}</p>
      </body>
    </html>
  );
}

function CompanyQuotationCoverageNotice({
  capacity,
  guestCount,
}: Readonly<{ capacity: number; guestCount: number }>) {
  if (capacity >= guestCount) return null;
  return (
    <p>
      <strong>Cobertura parcial:</strong> esta cotización cubre a {capacity} de
      las {guestCount} personas solicitadas.
    </p>
  );
}

function CompanyQuotationBreakfastLine({
  props,
}: Readonly<{ props: CompanyQuotationEmailData }>) {
  if (!props.breakfastRequested) return null;
  return (
    <p>
      {props.breakfastQuantity} × Desayuno:{" "}
      {formatClp(props.breakfastSubtotalClp)}
    </p>
  );
}

export function CompanyQuotationCustomerEmail(
  props: CompanyQuotationEmailData
) {
  return (
    <html lang="es">
      <body>
        <h1>Tu cotización de Vista Valle</h1>
        <p>
          Hemos preparado la cotización solicitada con los datos ingresados.
        </p>
        <p>Entrada: {props.checkIn}</p>
        <p>Salida: {props.checkOut}</p>
        <p>Personas: {props.guestCount}</p>
        <p>Estacionamiento: {props.requireParking ? "Sí" : "No"}</p>
        <CompanyQuotationCoverageNotice
          capacity={props.capacity}
          guestCount={props.guestCount}
        />
        {props.lines.map((line) => (
          <p key={line.slug}>
            {line.quantity} × {line.name}: {formatClp(line.subtotalClp)}
          </p>
        ))}
        <CompanyQuotationBreakfastLine props={props} />
        <p>Total: {formatClp(props.totalClp)}</p>
      </body>
    </html>
  );
}

export function CompanyQuotationAdminEmail(props: CompanyQuotationEmailData) {
  return (
    <html lang="es">
      <body>
        <h1>Nueva cotización empresarial</h1>
        <p>Empresa: {props.company}</p>
        <p>Contacto: {props.contact}</p>
        <p>Correo: {props.email}</p>
        <p>Teléfono: {props.phone || "No informado"}</p>
        <p>Estacionamiento: {props.requireParking ? "Sí" : "No"}</p>
        <p>Mensaje: {props.message}</p>
        <p>Entrada: {props.checkIn}</p>
        <p>Salida: {props.checkOut}</p>
        <p>Personas: {props.guestCount}</p>
        <CompanyQuotationCoverageNotice
          capacity={props.capacity}
          guestCount={props.guestCount}
        />
        {props.lines.map((line) => (
          <p key={line.slug}>
            {line.quantity} × {line.name}: {formatClp(line.subtotalClp)}
          </p>
        ))}
        <CompanyQuotationBreakfastLine props={props} />
        <p>Total: {formatClp(props.totalClp)}</p>
      </body>
    </html>
  );
}

/** Explicitly fictional data for isolated template rendering only. */
export const notificationEmailTemplateFixture: PayAtPropertyConfirmationEmailData =
  Object.freeze({
    checkIn: "2040-01-01",
    checkOut: "2040-01-03",
    contactEmail: "contacto@example.test",
    guestCount: 2,
    nights: 2,
    publicId: "VV-DEMO-EMAIL",
    roomName: "Habitación de demostración",
    totalClp: 120000,
  });
