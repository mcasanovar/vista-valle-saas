import { notFound } from "next/navigation";

import { AdminBackLink } from "@/features/admin/admin-back-link";
import { deliveryStateMeta } from "@/features/admin/company-quotation-delivery-state";
import { getAdminCompanyQuotationDetail } from "@/infrastructure/database/admin-company-quotation-source";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  style: "currency",
});

const timestampFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const notificationTypeLabels: Record<string, string> = {
  company_quotation_admin: "Aviso a administración",
  company_quotation_customer: "Cotización al cliente",
};

const notificationStatusLabels: Record<string, string> = {
  delivered: "Entregado",
  failed: "Falló",
  pending: "Pendiente",
  processing: "En proceso",
  retrying: "Reintentando",
};

export default async function CompanyQuotationDetail({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  await requireAdministrator();
  const { id } = await params;
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return <p role="status">Cotización no disponible.</p>;
  }
  const db = createProductionDatabase(boundary);
  const quotation = await getAdminCompanyQuotationDetail(db, id);
  if (!quotation) notFound();

  const [deliveryLabel, deliveryClassName] = deliveryStateMeta(
    quotation.deliveryState
  );

  return (
    <section className="space-y-5">
      <AdminBackLink
        fallbackHref="/admin/cotizaciones"
        label="Volver a cotizaciones"
      />
      <header>
        <h1 className="font-heading text-title">{quotation.company}</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Solicitada el {timestampFormatter.format(quotation.createdAt)}</span>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${deliveryClassName}`}
          >
            {deliveryLabel}
          </span>
        </p>
      </header>

      <section
        aria-labelledby="quotation-contact-heading"
        className="rounded-xl border border-border bg-card p-4"
      >
        <h2 id="quotation-contact-heading" className="font-heading text-lg">
          Empresa y contacto
        </h2>
        <dl className="mt-2 grid gap-2 text-sm tablet:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Empresa</dt>
            <dd className="font-semibold">{quotation.company}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Contacto</dt>
            <dd className="font-semibold">{quotation.contact}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-semibold">{quotation.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Teléfono</dt>
            <dd className="font-semibold">{quotation.phone}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Estacionamiento</dt>
            <dd className="font-semibold">
              {quotation.requireParking ? "Sí" : "No"}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="quotation-stay-heading"
        className="rounded-xl border border-border bg-card p-4"
      >
        <h2 id="quotation-stay-heading" className="font-heading text-lg">
          Estadía
        </h2>
        <dl className="mt-2 grid gap-2 text-sm tablet:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Entrada</dt>
            <dd className="font-semibold">{quotation.checkIn}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Salida</dt>
            <dd className="font-semibold">{quotation.checkOut}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Noches</dt>
            <dd className="font-semibold">{quotation.nights}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Personas</dt>
            <dd className="font-semibold">
              {quotation.guestCount} de {quotation.capacity} de capacidad
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="quotation-lines-heading"
        className="rounded-xl border border-border bg-card p-4"
      >
        <h2 id="quotation-lines-heading" className="font-heading text-lg">
          Habitaciones cotizadas
        </h2>
        <ul className="mt-2 space-y-2">
          {quotation.lines.map((line) => (
            <li
              key={line.roomSlug}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f2f3f7] pb-2 text-sm last:border-0"
            >
              <span>
                <span className="font-semibold">
                  {line.quantity} × {line.roomName}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {line.guestCount}{" "}
                  {line.guestCount === 1 ? "persona" : "personas"} · capacidad{" "}
                  {line.capacity} · {currency.format(line.nightlyPriceClp)} por
                  noche · {line.nights}{" "}
                  {line.nights === 1 ? "noche" : "noches"}
                </span>
              </span>
              <span className="font-bold">
                {currency.format(line.subtotalClp)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {quotation.breakfastRequested ? (
        <section
          aria-labelledby="quotation-breakfast-heading"
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 id="quotation-breakfast-heading" className="font-heading text-lg">
            Desayuno
          </h2>
          <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">
              {quotation.breakfastQuantity} por noche ·{" "}
              {quotation.breakfastUnitPriceClp === null
                ? "precio no registrado"
                : `${currency.format(quotation.breakfastUnitPriceClp)} cada uno`}{" "}
              · {quotation.nights}{" "}
              {quotation.nights === 1 ? "noche" : "noches"}
            </span>
            <span className="font-bold">
              {currency.format(quotation.breakfastSubtotalClp)}
            </span>
          </p>
        </section>
      ) : null}

      <section
        aria-labelledby="quotation-total-heading"
        className="rounded-xl border border-border bg-card p-4"
      >
        <h2 id="quotation-total-heading" className="font-heading text-lg">
          Total
        </h2>
        <p className="mt-1 text-2xl font-bold">
          {currency.format(quotation.totalClp)}
        </p>
      </section>

      {quotation.message ? (
        <section
          aria-labelledby="quotation-message-heading"
          className="rounded-xl border border-border bg-card p-4"
        >
          <h2 id="quotation-message-heading" className="font-heading text-lg">
            Mensaje de la empresa
          </h2>
          <p className="mt-1 whitespace-pre-line text-sm">
            {quotation.message}
          </p>
        </section>
      ) : null}

      <section
        aria-labelledby="quotation-notifications-heading"
        className="rounded-xl border border-border bg-card p-4"
      >
        <h2
          id="quotation-notifications-heading"
          className="font-heading text-lg"
        >
          Entrega de correos
        </h2>
        {quotation.notifications.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Esta cotización no tiene correos registrados.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {quotation.notifications.map((notification) => (
              <li
                key={`${notification.type}-${notification.createdAt.toISOString()}`}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f2f3f7] pb-2 last:border-0"
              >
                <span className="font-semibold">
                  {notificationTypeLabels[notification.type] ??
                    notification.type}
                </span>
                <span className="text-muted-foreground">
                  {notificationStatusLabels[notification.status] ??
                    notification.status}
                  {notification.attempts > 0
                    ? ` · ${notification.attempts} ${
                        notification.attempts === 1 ? "intento" : "intentos"
                      }`
                    : ""}
                  {notification.deliveredAt
                    ? ` · ${timestampFormatter.format(notification.deliveredAt)}`
                    : ""}
                  {notification.lastErrorCode
                    ? ` · ${notification.lastErrorCode}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
