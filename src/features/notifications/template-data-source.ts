import "server-only";

import { getServerEnvironment } from "@/config/server";
import { nights } from "@/features/availability";
import { getRoomReadSource } from "@/features/rooms";
import { mockReservationRepository } from "@/features/reservations";
import { getCompanyQuotationRepository } from "@/features/company-quotations";

import type { NotificationTemplateDataSource } from "./delivery-worker";

/** Mock-only template data composition; it never exposes guest contact data. */
export function getMockNotificationTemplateDataSource(): NotificationTemplateDataSource | null {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;

  const quotationRepository = getCompanyQuotationRepository("mock");

  return Object.freeze({
    getReservationEmailData: async (reservationId) => {
      const reservation =
        await mockReservationRepository.getReservationById(reservationId);
      if (!reservation) return null;
      const activeRooms = (await getRoomReadSource()).listActive();
      const items = reservation.items.map((item) => ({
        roomName:
          activeRooms.find((room) => room.id === item.roomId)?.name ??
          "Habitación",
        subtotalClp: item.subtotalClp,
      }));
      return Object.freeze({
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        contactEmail: getServerEnvironment().ADMIN_NOTIFICATION_EMAIL,
        guestCount: reservation.guestCount,
        nights: nights(reservation.checkIn, reservation.checkOut),
        origin: reservation.origin,
        publicId: reservation.publicId,
        roomName: items[0]?.roomName ?? "Habitación",
        items,
        totalClp: reservation.totalClp,
      });
    },
    getCompanyQuotationEmailData: async (quotationId) =>
      quotationRepository?.getById(quotationId) ?? null,
  });
}
