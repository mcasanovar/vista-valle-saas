import type { AdminCompanyQuotationDeliveryState } from "@/infrastructure/database/admin-company-quotation-source";

const meta = {
  delivered: [
    "Entregado",
    "bg-[var(--admin-reservation-confirmed-background)] text-[var(--admin-reservation-confirmed)]",
  ],
  failed: [
    "Falló",
    "bg-[var(--admin-reservation-cancelled-background)] text-[var(--admin-reservation-cancelled)]",
  ],
  pending: [
    "Pendiente",
    "bg-[var(--admin-reservation-pending-background)] text-[var(--admin-reservation-pending)]",
  ],
} as const;

/** Label and chip classes for the delivery state of a quotation's notifications. */
export function deliveryStateMeta(state: AdminCompanyQuotationDeliveryState) {
  return meta[state];
}
