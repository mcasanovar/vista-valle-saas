import type { AdminCalendarItem } from "@/infrastructure/database/admin-calendar-source";

export type CalendarItemStyle = Readonly<{
  colorVar: string;
  backgroundVar: string;
  className: string;
  label: string;
}>;

const reservationPaymentStyle = {
  paid: {
    backgroundVar: "--admin-reservation-paid-background",
    colorVar: "--admin-reservation-paid",
    label: "Pagada",
  },
  unpaid: {
    backgroundVar: "--admin-reservation-unpaid-background",
    colorVar: "--admin-reservation-unpaid",
    label: "No pagada",
  },
} as const;

/**
 * Visual identity per calendar item (spec: "Distinción visual por tipo").
 * Type is never color-only: hold adds a dashed border, block adds a
 * diagonal fill pattern (`.admin-calendar-block-pattern`, app/globals.css).
 * A reservation's color reflects payment status (`item.paid`), not
 * reservation status - see calendar-color-by-payment-status/design.md.
 */
export function calendarItemStyle(item: AdminCalendarItem): CalendarItemStyle {
  if (item.kind === "hold") {
    return {
      backgroundVar: "--admin-hold-background",
      className: "border-2 border-dashed",
      colorVar: "--admin-hold",
      label: "Retención",
    };
  }
  if (item.kind === "block") {
    return {
      backgroundVar: "--admin-block-background",
      className: "admin-calendar-block-pattern",
      colorVar: "--admin-block",
      label: "Bloqueo",
    };
  }
  const meta = item.paid
    ? reservationPaymentStyle.paid
    : reservationPaymentStyle.unpaid;
  return { ...meta, className: "" };
}
