import { notFound } from "next/navigation";

import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { getAdminReservationDetail } from "@/infrastructure/database/admin-reservation-source";
import { transitionAdminReservation } from "@/features/admin/reservation-actions";
import { ReservationTransitionControls } from "@/features/admin/reservation-transition-controls";
import { collectPayAtPropertyAdminAction } from "@/features/admin/pay-at-property-admin-collect-action";
import { refundFintocPaymentAction } from "@/features/admin/fintoc-refund-action";
import { markPaymentPaidAdminAction } from "@/features/admin/mark-payment-paid-action";
import { PayAtPropertyCollectionForm } from "@/features/payments/pay-at-property-collection-form";
import { FintocRefundForm } from "@/features/payments/fintoc-refund-form";
import { MarkPaymentPaidForm } from "@/features/payments/mark-payment-paid-form";
import { AdminBackLink } from "@/features/admin/admin-back-link";

const currency = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  style: "currency",
});

const statusLabels = {
  cancelled: "Cancelada",
  completed: "Completada",
  confirmed: "Confirmada",
  no_show: "No se presentó",
} as const;

const originLabels = {
  admin: "Administración",
  airbnb: "Airbnb",
  booking: "Booking",
  phone: "Teléfono",
  website: "Sitio web",
  whatsapp: "WhatsApp",
} as const;

const channelLabels = { airbnb: "Airbnb", booking: "Booking" } as const;

const originChipClasses = {
  admin: "bg-muted text-[var(--admin-neutral)]",
  airbnb: "bg-red-100 text-red-700",
  booking: "bg-blue-100 text-blue-700",
  phone: "bg-muted text-[var(--admin-neutral)]",
  website: "bg-purple-100 text-purple-700",
  whatsapp: "bg-muted text-[var(--admin-neutral)]",
} as const;

export default async function ReservationDetail({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return <p role="status">Reserva no disponible.</p>;
  }
  const db = createProductionDatabase(boundary);
  const reservation = await getAdminReservationDetail(db, id);
  if (!reservation) notFound();

  const hasUnresolvedPayment =
    reservation.status === "cancelled" &&
    reservation.payments.some(
      (payment) =>
        payment.status === "approved" &&
        payment.refundedAmountClp < payment.amountClp
    );

  return (
    <section className="space-y-5">
      <AdminBackLink fallbackHref="/admin/reservas" label="Volver a reservas" />
      <header>
        <h1 className="font-heading text-title">
          {reservation.guest.firstName} {reservation.guest.lastName}
        </h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{reservation.publicId}</span>
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${originChipClasses[reservation.origin]}`}
          >
            {originLabels[reservation.origin]}
          </span>
        </p>
        <p className="mt-1 font-semibold">
          {statusLabels[reservation.status]}
        </p>
      </header>

      {hasUnresolvedPayment ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive bg-[var(--admin-reservation-cancelled-background)] p-3 text-sm text-destructive"
        >
          Esta reserva está cancelada pero tiene un pago aprobado sin
          reembolsar. Requiere resolución financiera manual.
        </p>
      ) : null}

      <section aria-labelledby="guest-heading" className="rounded-xl border border-border bg-card p-4">
        <h2 id="guest-heading" className="font-heading text-lg">
          Huésped
        </h2>
        {reservation.externalPlatform ? (
          <p className="mt-1 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Datos provisionales generados automáticamente — esta reserva
            llegó por sincronización con {channelLabels[reservation.externalPlatform]}.
            Contacta al huésped a través de esa plataforma; estos no son
            datos de contacto reales.
          </p>
        ) : null}
        <dl className="mt-2 grid gap-2 tablet:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Nombre</dt>
            <dd>
              {reservation.guest.firstName} {reservation.guest.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd>{reservation.guest.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Teléfono</dt>
            <dd>{reservation.guest.phone}</dd>
          </div>
          {reservation.guest.rut ? (
            <div>
              <dt className="text-xs text-muted-foreground">RUT</dt>
              <dd>{reservation.guest.rut}</dd>
            </div>
          ) : null}
          {reservation.guest.company ? (
            <div>
              <dt className="text-xs text-muted-foreground">Empresa</dt>
              <dd>{reservation.guest.company}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="items-heading" className="rounded-xl border border-border bg-card p-4">
        <h2 id="items-heading" className="font-heading text-lg">
          Habitaciones
        </h2>
        <p className="text-sm text-muted-foreground">
          {reservation.checkIn} a {reservation.checkOut}
        </p>
        <ul className="mt-2 space-y-2">
          {reservation.items.map((item) => (
            <li
              key={item.roomId}
              className="flex items-center justify-between border-b border-[#f2f3f7] pb-2 last:border-0"
            >
              <span>
                {item.roomName} · {item.nights} noches
              </span>
              <span className="font-semibold">
                {currency.format(item.subtotalClp)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center justify-between text-lg font-bold">
          <span>Total</span>
          <span>{currency.format(reservation.totalClp)}</span>
        </p>
      </section>

      {reservation.guestComment ? (
        <section aria-labelledby="comment-heading" className="rounded-xl border border-border bg-card p-4">
          <h2 id="comment-heading" className="font-heading text-lg">
            Comentario del huésped
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {reservation.guestComment}
          </p>
        </section>
      ) : null}

      {reservation.invoiceRequest ? (
        <section aria-labelledby="invoice-heading" className="rounded-xl border border-border bg-card p-4">
          <h2 id="invoice-heading" className="font-heading text-lg">
            Factura
          </h2>
          <dl className="mt-2 grid gap-2 tablet:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                Razón social
              </dt>
              <dd>{reservation.invoiceRequest.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">RUT</dt>
              <dd>{reservation.invoiceRequest.rut}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Giro</dt>
              <dd>{reservation.invoiceRequest.businessActivity}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Teléfono</dt>
              <dd>{reservation.invoiceRequest.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd>{reservation.invoiceRequest.email}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="payments-heading" className="rounded-xl border border-border bg-card p-4">
        <h2 id="payments-heading" className="font-heading text-lg">
          Pago(s)
        </h2>
        {reservation.payments.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            No hay pagos registrados.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {reservation.payments.map((payment) => (
              <li key={payment.id} className="border-b border-[#f2f3f7] pb-3 last:border-0">
                <p className="flex items-center justify-between">
                  <span className="font-semibold">
                    {payment.provider === "fintoc" ? "Fintoc" : "Pago al llegar"}
                  </span>
                  <span>{currency.format(payment.amountClp)}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Estado: {payment.status}
                  {payment.refundedAmountClp > 0
                    ? ` · Reembolsado: ${currency.format(payment.refundedAmountClp)}`
                    : ""}
                </p>
                {payment.provider === "pay_at_property" &&
                payment.status === "pending" ? (
                  <PayAtPropertyCollectionForm
                    action={collectPayAtPropertyAdminAction}
                    reservationId={reservation.id}
                    totalClp={payment.amountClp}
                  />
                ) : null}
                {payment.provider === "fintoc" &&
                payment.status === "approved" ? (
                  <FintocRefundForm
                    action={refundFintocPaymentAction}
                    paymentId={payment.id}
                    remainingClp={
                      payment.amountClp - payment.refundedAmountClp
                    }
                  />
                ) : null}
                {payment.provider !== "pay_at_property" &&
                payment.status === "pending" ? (
                  <MarkPaymentPaidForm
                    action={markPaymentPaidAdminAction}
                    paymentId={payment.id}
                    reservationId={reservation.id}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {reservation.channelSyncTasks.length > 0 ? (
        <section aria-labelledby="channel-sync-heading" className="rounded-xl border border-border bg-card p-4">
          <h2 id="channel-sync-heading" className="font-heading text-lg">
            Sincronización de canales
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {reservation.channelSyncTasks.map((task) => (
              <li key={task.channel}>
                {channelLabels[task.channel]}:{" "}
                {task.status === "completed" ? "Completado" : "Pendiente"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reservation.auditEvents.length > 0 ? (
        <section aria-labelledby="audit-heading" className="rounded-xl border border-border bg-card p-4">
          <h2 id="audit-heading" className="font-heading text-lg">
            Auditoría
          </h2>
          <ul className="mt-2 space-y-2 text-sm">
            {reservation.auditEvents.map((event, index) => (
              <li key={index} className="text-muted-foreground">
                {event.occurredAt.toLocaleString("es-CL")} · {event.action}
                {event.actorUserId ? ` · ${event.actorUserId}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reservation.status === "confirmed" ? (
        <ReservationTransitionControls
          action={transitionAdminReservation}
          id={id}
        />
      ) : null}
    </section>
  );
}
