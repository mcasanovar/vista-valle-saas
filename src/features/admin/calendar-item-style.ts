import type { AdminCalendarItem } from "@/infrastructure/database/admin-calendar-source";

export type CalendarItemStyle = Readonly<{
  colorVar: string;
  backgroundVar: string;
  className: string;
  label: string;
}>;

const reservationStatusStyle: Readonly<
  Record<
    NonNullable<AdminCalendarItem["status"]>,
    Readonly<{ colorVar: string; backgroundVar: string; label: string }>
  >
> = {
  cancelled: {
    backgroundVar: "--admin-reservation-cancelled-background",
    colorVar: "--admin-reservation-cancelled",
    label: "Cancelada",
  },
  completed: {
    backgroundVar: "--admin-reservation-confirmed-background",
    colorVar: "--admin-reservation-confirmed",
    label: "Completada",
  },
  confirmed: {
    backgroundVar: "--admin-reservation-confirmed-background",
    colorVar: "--admin-reservation-confirmed",
    label: "Confirmada",
  },
  no_show: {
    backgroundVar: "--admin-reservation-pending-background",
    colorVar: "--admin-reservation-pending",
    label: "No se presentó",
  },
};

/**
 * Visual identity per calendar item (spec: "Distinción visual por tipo").
 * Type is never color-only: hold adds a dashed border, block adds a
 * diagonal fill pattern (`.admin-calendar-block-pattern`, app/globals.css).
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
  const meta =
    reservationStatusStyle[item.status ?? "confirmed"] ??
    reservationStatusStyle.confirmed;
  return { ...meta, className: "" };
}
