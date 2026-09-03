import Link from "next/link";
import {
  CircleDollarSign,
  MailWarning,
  MailX,
  RotateCw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import {
  getOperationalAlerts,
  type OperationalAlert,
} from "@/features/admin/operational-alerts";
import { getNotificationDeliveryStatuses } from "@/features/admin/notification-delivery-status";
import { OriginIcon, originLabels } from "@/features/admin/origin-icon";

const alertKindIcon: Record<OperationalAlert["kind"], LucideIcon> = {
  channel_sync_conflict: TriangleAlert,
  notification_failure: MailWarning,
  payment_pending: CircleDollarSign,
};

const alertKindBadgeClass: Record<OperationalAlert["kind"], string> = {
  channel_sync_conflict:
    "bg-[var(--admin-danger-background)] text-[var(--admin-danger)]",
  notification_failure:
    "bg-[var(--admin-danger-background)] text-[var(--admin-danger)]",
  payment_pending:
    "bg-[var(--admin-warning-background)] text-[var(--admin-warning)]",
};

const currency = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  style: "currency",
});

const nextAttemptFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function AlertBadge({ kind }: Readonly<{ kind: OperationalAlert["kind"] }>) {
  const Icon = alertKindIcon[kind];
  return (
    <span
      className={`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full ${alertKindBadgeClass[kind]}`}
    >
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

/** Guest/origin/total for the reservation behind the alert, when known - lets an admin triage without opening it. */
function AlertMeta({ alert }: Readonly<{ alert: OperationalAlert }>) {
  if (!alert.guestName && !alert.origin && alert.totalClp === undefined)
    return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {alert.guestName ? (
        <span className="font-semibold text-foreground">
          {alert.guestName}
        </span>
      ) : null}
      {alert.origin ? (
        <span className="inline-flex items-center gap-1">
          <OriginIcon accessibleLabel origin={alert.origin} className="size-3.5" />
          {originLabels[alert.origin]}
        </span>
      ) : null}
      {alert.totalClp !== undefined ? (
        <span className="font-semibold">{currency.format(alert.totalClp)}</span>
      ) : null}
    </p>
  );
}

function AlertRow({ alert }: Readonly<{ alert: OperationalAlert }>) {
  const content = (
    <>
      <AlertBadge kind={alert.kind} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{alert.label}</p>
        <AlertMeta alert={alert} />
      </div>
    </>
  );
  const className =
    "flex items-start gap-3 border-b border-[#f2f3f7] px-4 py-3 last:border-0 laptop:px-5";

  if (!alert.reservationId) {
    return <li className={className}>{content}</li>;
  }
  return (
    <li className="border-b border-[#f2f3f7] last:border-0">
      <Link
        href={`/admin/reservas/${alert.reservationId}`}
        className={`${className} border-b-0 hover:bg-muted`}
      >
        {content}
      </Link>
    </li>
  );
}

function AlertsCard({ alerts }: Readonly<{ alerts: readonly OperationalAlert[] }>) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-[#eef0f5] px-4 py-3.5 laptop:px-5 laptop:py-4">
        <h2 className="font-heading text-base font-bold text-[#181d2b] laptop:text-[15px]">
          Alertas abiertas
        </h2>
      </div>
      {alerts.length === 0 ? (
        <p role="status" className="p-5 text-sm text-muted-foreground">
          No hay alertas abiertas.
        </p>
      ) : (
        <ul>
          {alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DeliveryRow({
  delivery,
}: Readonly<{
  delivery: Readonly<{
    attempts: number;
    errorCode?: string;
    nextAttemptAt?: Date;
    status: "failed" | "retrying";
  }>;
}>) {
  const failed = delivery.status === "failed";
  const Icon = failed ? MailX : RotateCw;
  return (
    <li className="flex items-center gap-3 border-b border-[#f2f3f7] px-4 py-3 last:border-0 laptop:px-5">
      <span
        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${
          failed
            ? "bg-[var(--admin-danger-background)] text-[var(--admin-danger)]"
            : "bg-[var(--admin-warning-background)] text-[var(--admin-warning)]"
        }`}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {failed ? "Entrega fallida" : "Reintento programado"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Intento {delivery.attempts}
          {delivery.nextAttemptAt
            ? ` · próximo intento ${nextAttemptFormatter.format(delivery.nextAttemptAt)}`
            : ""}
          {delivery.errorCode ? ` · código ${delivery.errorCode}` : ""}
        </p>
      </div>
    </li>
  );
}

export default async function AlertsPage() {
  const alerts = await getOperationalAlerts();
  const deliveries = getNotificationDeliveryStatuses();
  return (
    <section
      aria-labelledby="alerts-page-title"
      className="space-y-4 tablet:space-y-[18px] laptop:space-y-[22px]"
    >
      <h1 id="alerts-page-title" className="font-heading text-title">
        Seguimiento operativo
      </h1>
      <AlertsCard alerts={alerts} />
      <section
        aria-labelledby="delivery-status-title"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="border-b border-[#eef0f5] px-4 py-3.5 laptop:px-5 laptop:py-4">
          <h2
            id="delivery-status-title"
            className="font-heading text-base font-bold text-[#181d2b] laptop:text-[15px]"
          >
            Entregas de notificaciones
          </h2>
        </div>
        {deliveries ? (
          deliveries.length > 0 ? (
            <ul aria-live="polite">
              {deliveries.map((delivery, index) => (
                <DeliveryRow
                  key={`${delivery.status}-${delivery.attempts}-${index}`}
                  delivery={delivery}
                />
              ))}
            </ul>
          ) : (
            <p role="status" className="p-5 text-sm text-muted-foreground">
              No hay entregas fallidas ni reintentos.
            </p>
          )
        ) : (
          <p role="status" className="p-5 text-sm text-muted-foreground">
            El estado de entregas no está disponible.
          </p>
        )}
      </section>
    </section>
  );
}
