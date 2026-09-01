import { RoomLockConflictError } from "@/features/availability";
import { publicFintocCheckoutCandidate } from "@/features/reservations";
import { isBookingAcceptanceEnabled } from "@/features/reservations/confirm-pay-at-property";
import {
  FintocCheckoutInputError,
  initiatePublicFintocCheckout,
} from "@/features/payments/fintoc-checkout-service";
import { FintocCheckoutUnavailableError } from "@/features/payments/fintoc-checkout";
import { getPublicBookingRequestLimiter } from "@/infrastructure/security/request-limiter";

const maxCheckoutRequestBytes = 16 * 1024;

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
      contentLength > maxCheckoutRequestBytes
    ) {
      return Response.json(
        { message: "No pudimos procesar este intento de pago." },
        { status: 413 }
      );
    }
    const limiter = getPublicBookingRequestLimiter();
    if (!limiter) {
      return Response.json(
        { message: "No pudimos iniciar el pago. Inténtalo nuevamente." },
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
    const result = await initiatePublicFintocCheckout(
      publicFintocCheckoutCandidate(await request.json())
    );
    return Response.json(
      { redirectUrl: result.redirectUrl },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RoomLockConflictError) {
      return Response.json(
        { message: "La habitación ya no está disponible para esas fechas." },
        { status: 409 }
      );
    }
    if (error instanceof FintocCheckoutInputError) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof FintocCheckoutUnavailableError) {
      return Response.json(
        { message: "No pudimos iniciar el pago en línea. Inténtalo nuevamente." },
        { status: 503 }
      );
    }
    return Response.json(
      { message: "No pudimos iniciar el pago en línea. Inténtalo nuevamente." },
      { status: 500 }
    );
  }
}
