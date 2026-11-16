import "server-only";

import { getServerEnvironment } from "@/config/server";
import { nights } from "@/features/availability";
import { getRoomReadSource } from "@/features/rooms";
import {
  guestFullName,
  mockGuestRepository,
  mockReservationRepository,
} from "@/features/reservations";
import { getCompanyQuotationRepository } from "@/features/company-quotations";

import type { NotificationTemplateDataSource } from "./delivery-worker";

/** Mock-only template data composition; of the guest it exposes only the name the email greets or reports. */
export function getMockNotificationTemplateDataSource(): NotificationTemplateDataSource | null {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;

  const quotationRepository = getCompanyQuotationRepository("mock");

  return Object.freeze({
    getReservationEmailData: async (reservationId) => {
      const reservation =
        await mockReservationRepository.getReservationById(reservationId);
      if (!reservation) return null;
      const guest = await mockGuestRepository.getGuestById(reservation.guestId);
      const activeRooms = (await getRoomReadSource()).listActive();
      const items = reservation.items.map((item) => ({
        guestCount: item.guestCount,
        roomId: item.roomId,
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
        guestName: guest ? guestFullName(guest) : undefined,
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
    getRoomNamesByIds: async (roomIds) => {
      const rooms = (await getRoomReadSource()).listActive();
      return new Map(
        roomIds.flatMap((roomId) => {
          const room = rooms.find((candidate) => candidate.id === roomId);
          return room ? [[roomId, room.name] as const] : [];
        })
      );
    },
  });
}
