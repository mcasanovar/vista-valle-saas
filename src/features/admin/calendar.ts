import "server-only";

import { createLodgingInterval } from "@/features/availability";
import type { ReservationOrigin } from "@/features/reservations";
import {
  queryAdminCalendar,
  type AdminCalendar,
  type AdminCalendarFilter,
  type AdminCalendarItem,
} from "@/infrastructure/database/admin-calendar-source";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

export type { AdminCalendar, AdminCalendarFilter };
export type CalendarItem = AdminCalendarItem;

/** Room ids/names match `mockDemoRooms` (`@/features/rooms/mock-fixtures`) so the mock calendar lines up with the mock room list `getRoomReadSource` returns. */
const mockItems: readonly AdminCalendarItem[] = Object.freeze([
  {
    checkIn: "2026-10-05",
    checkOut: "2026-10-08",
    guestName: "Huésped Demo",
    id: "reservation-demo",
    kind: "reservation",
    origin: "website",
    room: "Habitación Individual",
    roomId: "demo-room-valle",
    sourceId: "reservation-demo",
    status: "confirmed",
  },
  {
    checkIn: "2026-10-08",
    checkOut: "2026-10-10",
    guestName: "Huésped Demo",
    id: "hold-demo",
    kind: "hold",
    room: "Habitación Matrimonial",
    roomId: "demo-room-andes",
    sourceId: "hold-demo",
  },
  {
    checkIn: "2026-10-11",
    checkOut: "2026-10-13",
    id: "block-demo",
    kind: "block",
    reason: "Mantención",
    room: "Habitación Doble",
    roomId: "demo-room-terra",
    sourceId: "block-demo",
  },
]);

function mockCalendar(filter: AdminCalendarFilter): AdminCalendar {
  const window = createLodgingInterval(filter.checkIn, filter.checkOut);
  const items = mockItems.filter(
    (item) =>
      item.checkIn < window.checkOut &&
      item.checkOut > window.checkIn &&
      (!filter.roomId || item.roomId === filter.roomId) &&
      (!filter.origin ||
        item.kind !== "reservation" ||
        item.origin === filter.origin)
  );
  return Object.freeze({ items: Object.freeze(items), window });
}

/**
 * Real occupancy in production (task 1.2, design.md decision "Fuente de
 * datos"), mock occupancy otherwise. Unlike the previous
 * `createAdminCalendarSource`, production never returns nothing - the
 * calendar reads from `queryAdminCalendar`
 * (`src/infrastructure/database/admin-calendar-source.ts`) whenever
 * `DATABASE_URL` is configured (see `createDatabaseBoundary`, **BREAKING**
 * per proposal.md).
 */
export async function getAdminCalendar(
  filter: AdminCalendarFilter
): Promise<AdminCalendar> {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return mockCalendar(filter);
  }
  const db = createProductionDatabase(boundary);
  return queryAdminCalendar(db, filter);
}

export function isKnownReservationOrigin(
  value: string
): value is ReservationOrigin {
  const origins: readonly ReservationOrigin[] = [
    "website",
    "airbnb",
    "booking",
    "phone",
    "whatsapp",
    "admin",
  ];
  return (origins as readonly string[]).includes(value);
}
