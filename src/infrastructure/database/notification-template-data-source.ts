import "server-only";

import { inArray } from "drizzle-orm";

import { getServerEnvironment } from "@/config/server";
import { nights } from "@/features/availability";
import type { NotificationTemplateDataSource } from "@/features/notifications";
import { rooms } from "@/persistence/schema";
import { createDrizzleCompanyQuotationRepository } from "./company-quotation-repository";
import { createDrizzleReservationRepository } from "./reservation-repository";
import type { ProductionDatabase } from "./client";

/**
 * Production data boundary for notification rendering. Reservation and
 * quotation data is read only from PostgreSQL by its trusted outbox
 * identifier, never from payload fields or a mock repository.
 */
export function createProductionNotificationTemplateDataSource(
  db: ProductionDatabase
): NotificationTemplateDataSource {
  const quotations = createDrizzleCompanyQuotationRepository(db);
  const reservations = createDrizzleReservationRepository(db);

  const roomNamesByIds = async (roomIds: readonly string[]) => {
    if (roomIds.length === 0) return new Map<string, string>();
    // Read straight from `rooms` with no active filter: a room a stay
    // edit removed may well be inactive, and it still needs a name.
    const rows = await db
      .select({ id: rooms.id, name: rooms.name })
      .from(rooms)
      .where(inArray(rooms.id, [...roomIds]));
    return new Map(
      rows.flatMap((row) => (row.name ? [[row.id, row.name] as const] : []))
    );
  };

  return Object.freeze({
    getReservationEmailData: async (reservationId) => {
      const reservation = await reservations.getReservationById(reservationId);
      if (!reservation) return null;
      const names = await roomNamesByIds(
        reservation.items.map((item) => item.roomId)
      );
      // A room renamed or deactivated after the booking must not stop the
      // confirmation email, so an unresolved name falls back to a generic
      // label - as the mock source does - rather than failing delivery.
      const items = reservation.items.map((item) => ({
        guestCount: item.guestCount,
        roomId: item.roomId,
        roomName: names.get(item.roomId) ?? "Habitación",
        subtotalClp: item.subtotalClp,
      }));
      return Object.freeze({
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        contactEmail: getServerEnvironment().ADMIN_NOTIFICATION_EMAIL,
        guestCount: reservation.guestCount,
        items,
        nights: nights(reservation.checkIn, reservation.checkOut),
        origin: reservation.origin,
        publicId: reservation.publicId,
        roomName: items[0]?.roomName ?? "Habitación",
        totalClp: reservation.totalClp,
      });
    },
    getCompanyQuotationEmailData: (quotationId) =>
      quotations.getById(quotationId),
    getRoomNamesByIds: roomNamesByIds,
  });
}
