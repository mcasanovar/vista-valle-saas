import { RoomLockConflictError } from "@/features/availability";
import { publicOnlineCheckoutCandidate } from "@/features/reservations";
import { isBookingAcceptanceEnabled } from "@/features/reservations/confirm-pay-at-property";
import {
  MercadoPagoCheckoutInputError,
  initiatePublicMercadoPagoCheckout,
} from "@/features/payments/mercado-pago-checkout-service";
import { MercadoPagoCheckoutUnavailableError } from "@/features/payments/mercado-pago-checkout";
import { getPublicBookingRequestLimiter } from "@/infrastructure/security/request-limiter";
import { getServerPaymentMethodSettingsRepository } from "@/infrastructure/database/payment-method-settings-source";

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
    const paymentMethodSettings =
      await getServerPaymentMethodSettingsRepository()?.get();
    if (paymentMethodSettings?.payByCardEnabled === false) {
      return Response.json(
        {
          message:
            "Pagar con tarjeta no está disponible en este momento. Escríbenos por WhatsApp para reservar.",
        },
        { status: 503 }
      );
    }
    const result = await initiatePublicMercadoPagoCheckout(
      publicOnlineCheckoutCandidate(await request.json())
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
    if (error instanceof MercadoPagoCheckoutInputError) {
      return Response.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof MercadoPagoCheckoutUnavailableError) {
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
