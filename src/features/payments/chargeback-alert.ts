import "server-only";
import { createProductionDatabase } from "@/infrastructure/database/client";
import {
  listOperationalAlerts,
  recordOperationalAlert,
  type OperationalAlertRow,
} from "@/infrastructure/database/operational-alerts-source";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

export const PAYMENT_CHARGEBACK_MESSAGE =
  "Se recibió un contracargo sobre un pago con tarjeta ya aprobado. Revise la reserva; no se modificó automáticamente.";

export type PaymentChargebackAlert = Readonly<{
  id: string;
  reservationId: string;
  message: string;
  createdAt: Date;
}>;

const chargebackAlertsKey = Symbol.for(
  "vista-valle.mock.payment-chargeback-alerts"
);

function getChargebackAlerts(): PaymentChargebackAlert[] {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: PaymentChargebackAlert[] | undefined;
  };
  return (scope[chargebackAlertsKey] ??= []);
}

function fromRow(row: OperationalAlertRow): PaymentChargebackAlert {
  return Object.freeze({
    id: row.id,
    reservationId: row.reservationId ?? "",
    message: row.message,
    createdAt: row.createdAt,
  });
}

/**
 * Raised when a card payment already `approved` receives a contracargo
 * (see `mercado-pago-payment-integration` spec, "Contracargo sobre un
 * pago con tarjeta ya aprobado" and `payment-processing` spec,
 * "Contracargo posterior a un pago en línea aprobado"). Deliberately does
 * not touch the reservation or room occupancy — this only surfaces the
 * event for an administrator to review manually.
 */
export async function recordPaymentChargebackAlert(
  input: Readonly<{ reservationId: string }>
): Promise<PaymentChargebackAlert> {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    const alert: PaymentChargebackAlert = Object.freeze({
      id: crypto.randomUUID(),
      reservationId: input.reservationId,
      message: PAYMENT_CHARGEBACK_MESSAGE,
      createdAt: new Date(),
    });
    getChargebackAlerts().push(alert);
    return alert;
  }
  const db = createProductionDatabase(boundary);
  const row = await recordOperationalAlert(db, {
    kind: "payment_chargeback",
    message: PAYMENT_CHARGEBACK_MESSAGE,
    reservationId: input.reservationId,
  });
  return fromRow(row);
}

export async function listPaymentChargebackAlerts(): Promise<
  readonly PaymentChargebackAlert[]
> {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return Object.freeze([...getChargebackAlerts()]);
  }
  const db = createProductionDatabase(boundary);
  const rows = await listOperationalAlerts(db);
  return Object.freeze(
    rows.filter((row) => row.kind === "payment_chargeback").map(fromRow)
  );
}
