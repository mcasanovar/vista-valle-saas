import { createLodgingInterval } from "@/features/availability";
import type { RoomReadSource } from "@/features/rooms";
import { buildReservationQuote } from "./quote";

export class BookingSummaryInputError extends Error {
  readonly code = "INVALID_BOOKING_SUMMARY" as const;
}

export function buildBookingSummary(
  candidate: Record<string, unknown>,
  roomSource: RoomReadSource
) {
  const roomKey = typeof candidate.room === "string" ? candidate.room : "";
  const room = roomSource
    .listActive()
    .find((item) => item.id === roomKey || item.slug === roomKey);
  if (!room)
    throw new BookingSummaryInputError(
      "La habitación seleccionada ya no está disponible."
    );
  try {
    const quote = buildReservationQuote(
      candidate,
      room,
      createLodgingInterval(
        String(candidate.checkIn ?? ""),
        String(candidate.checkOut ?? "")
      )
    );
    return Object.freeze({
      room: { id: room.id, name: room.name, slug: room.slug },
      checkIn: String(candidate.checkIn),
      checkOut: String(candidate.checkOut),
      guestCount: quote.guest.guestCount,
      pricing: quote.pricing,
    });
  } catch (error) {
    if (error instanceof BookingSummaryInputError) throw error;
    throw new BookingSummaryInputError(
      "Revisa tus fechas y datos de huésped antes de ver el resumen."
    );
  }
}
