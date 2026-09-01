import { RoomLockConflictError } from "@/features/availability";
import {
  BookingConfirmationInputError,
  BookingConfirmationUnavailableError,
  getPayAtPropertyBookingConfirmationService,
  isBookingAcceptanceEnabled,
} from "@/features/reservations/confirm-pay-at-property";
import { publicBookingConfirmationCandidate } from "@/features/reservations/booking-confirmation-candidate";
import {
  assertBookingIdempotencyKey,
  InvalidBookingIdempotencyKeyError,
  ReusedBookingIdempotencyKeyError,
} from "@/features/reservations/booking-idempotency";
import { getPublicBookingRequestLimiter } from "@/infrastructure/security/request-limiter";

const maxBookingRequestBytes = 16 * 1024;

export async function POST(request: Request) {
  try {
    if (!isBookingAcceptanceEnabled()) {
      return Response.json(
        {
          message:
            "Las reservas directas están pausadas por el momento. Escríbenos por WhatsApp para reservar.",
        },
        { status: 503 }
      );
    }
    const contentLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(contentLength) &&
      contentLength > maxBookingRequestBytes
    ) {
      return Response.json(
        { message: "No pudimos procesar este intento de reserva." },
        { status: 413 }
      );
    }
    const limiter = getPublicBookingRequestLimiter();
    if (!limiter) {
      return Response.json(
        { message: "No pudimos confirmar la reserva. Inténtalo nuevamente." },
        { status: 503 }
      );
    }
    const limit = limiter.consume(request);
    if (!limit.allowed) {
      return Response.json(
        { message: "Intenta nuevamente en unos minutos." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        }
      );
    }
    const command = getPayAtPropertyBookingConfirmationService();
    const idempotencyKey = assertBookingIdempotencyKey(
      request.headers.get("Idempotency-Key")
    );
    const confirmation = await command(
      publicBookingConfirmationCandidate(await request.json()),
      idempotencyKey
    );
    return Response.json(confirmation, { status: 201 });
  } catch (error) {
    if (error instanceof RoomLockConflictError) {
      return Response.json(
        { message: "La habitación ya no está disponible para esas fechas." },
        { status: 409 }
      );
    }
    if (error instanceof BookingConfirmationInputError) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    if (
      error instanceof InvalidBookingIdempotencyKeyError ||
      error instanceof ReusedBookingIdempotencyKeyError
    ) {
      return Response.json(
        { message: "No pudimos procesar este intento de reserva." },
        { status: 400 }
      );
    }
    if (error instanceof BookingConfirmationUnavailableError) {
      return Response.json(
        { message: "No pudimos confirmar la reserva. Inténtalo nuevamente." },
        { status: 503 }
      );
    }
    return Response.json(
      { message: "No pudimos confirmar la reserva. Inténtalo nuevamente." },
      { status: 500 }
    );
  }
}
