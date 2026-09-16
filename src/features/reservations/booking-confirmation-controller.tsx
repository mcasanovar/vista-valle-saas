"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Feedback } from "@/presentation/atoms";
import {
  publicApiResponseError,
  safePublicErrorMessage,
} from "@/presentation/public-api-message";
import { clearSessionRoomSelection } from "./selection-session";

type ConfirmationResponse = Readonly<{ publicId: string; message?: string }>;
type OnlineCheckoutResponse = Readonly<{
  redirectUrl: string;
  message?: string;
}>;

type PaymentSelection = "pay_at_property" | "fintoc" | "mercado_pago";

/**
 * Client-side wiring only; the server reconstructs every authoritative
 * value. Every method here supports one or more rooms under a single
 * payment for the total (see `add-mercado-pago-checkout-pro` design.md
 * decision 1) — there is no room-count gate. `payAtPropertyEnabled`
 * (pagar al llegar), `payOnlineEnabled` (Fintoc, transferencia bancaria)
 * and `payByCardEnabled` (Mercado Pago, tarjeta) reflect the admin's
 * payment-method toggles (see `admin-payment-method-settings`): a
 * disabled method is hidden from selection here, and independently
 * rejected server-side by the confirmation endpoints if requested
 * directly.
 */
export function BookingConfirmationController({
  bookingEnabled,
  payAtPropertyEnabled = true,
  payOnlineEnabled = true,
  payByCardEnabled = true,
}: Readonly<{
  bookingEnabled: boolean;
  payAtPropertyEnabled?: boolean;
  payOnlineEnabled?: boolean;
  payByCardEnabled?: boolean;
}>) {
  const router = useRouter();
  const idempotencyKeyRef = useRef<string | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [pendingMode, setPendingMode] = useState<PaymentSelection>();
  const showPayAtProperty = payAtPropertyEnabled;
  const showFintoc = payOnlineEnabled;
  const showMercadoPago = payByCardEnabled;
  const [selectedMode, setSelectedMode] = useState<PaymentSelection | undefined>(
    showPayAtProperty
      ? "pay_at_property"
      : showFintoc
        ? "fintoc"
        : showMercadoPago
          ? "mercado_pago"
          : undefined
  );

  const confirmPayAtProperty = async () => {
    setPendingMode("pay_at_property");
    setError(undefined);
    try {
      const query = new URLSearchParams(window.location.search);
      if (!query.get("guestCount") && query.get("guests"))
        query.set("guestCount", query.get("guests")!);
      const idempotencyKey =
        idempotencyKeyRef.current ?? `booking-${crypto.randomUUID()}`;
      idempotencyKeyRef.current = idempotencyKey;
      const response = await fetch("/api/bookings/pay-at-property", {
        body: JSON.stringify(Object.fromEntries(query)),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        method: "POST",
      });
      const body = (await response.json()) as ConfirmationResponse;
      if (!response.ok || !body.publicId) {
        if (response.status >= 400 && response.status < 500) {
          idempotencyKeyRef.current = undefined;
        }
        throw publicApiResponseError(
          body,
          "No pudimos confirmar la reserva. Inténtalo nuevamente."
        );
      }
      clearSessionRoomSelection();
      router.push(`/reserva/${encodeURIComponent(body.publicId)}`);
    } catch (cause) {
      setError(
        safePublicErrorMessage(
          cause,
          "No pudimos confirmar la reserva. Inténtalo nuevamente."
        )
      );
    } finally {
      setPendingMode(undefined);
    }
  };

  const confirmOnline = async (mode: "fintoc" | "mercado_pago") => {
    setPendingMode(mode);
    setError(undefined);
    try {
      const query = new URLSearchParams(window.location.search);
      const endpoint =
        mode === "fintoc"
          ? "/api/bookings/fintoc-checkout"
          : "/api/bookings/mercadopago-checkout";
      const response = await fetch(endpoint, {
        body: JSON.stringify(Object.fromEntries(query)),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as OnlineCheckoutResponse;
      if (!response.ok || !body.redirectUrl) {
        throw publicApiResponseError(
          body,
          "No pudimos iniciar el pago en línea. Inténtalo nuevamente."
        );
      }
      clearSessionRoomSelection();
      window.location.href = body.redirectUrl;
    } catch (cause) {
      setError(
        safePublicErrorMessage(
          cause,
          "No pudimos iniciar el pago en línea. Inténtalo nuevamente."
        )
      );
      setPendingMode(undefined);
    }
  };

  if (!bookingEnabled) {
    return (
      <div className="space-y-3 border-t border-border pt-4">
        <Feedback variant="warning" title="Reservas directas pausadas">
          Las reservas directas están pausadas por el momento. Escríbenos por
          WhatsApp para reservar.
        </Feedback>
      </div>
    );
  }

  const pending = pendingMode !== undefined;

  const confirm = () => {
    if (selectedMode === "fintoc") return void confirmOnline("fintoc");
    if (selectedMode === "mercado_pago") return void confirmOnline("mercado_pago");
    if (selectedMode === "pay_at_property") return void confirmPayAtProperty();
  };

  if (!showPayAtProperty && !showFintoc && !showMercadoPago) {
    return (
      <div className="space-y-4 border-t border-border pt-4">
        <div aria-live="assertive">
          {error ? (
            <Feedback variant="error" title="No pudimos confirmar la reserva">
              {error}
            </Feedback>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <p className="text-sm text-foreground">
        Elige cómo quieres pagar tu reserva.
      </p>
      <div
        role="radiogroup"
        aria-label="Modalidad de pago"
        className="grid gap-3 tablet:grid-cols-2"
      >
        {showPayAtProperty ? (
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 shadow-md transition-colors ${
              selectedMode === "pay_at_property"
                ? "border-accent bg-accent/10"
                : "border-transparent bg-card hover:border-border"
            }`}
          >
            <input
              type="radio"
              name="paymentMode"
              value="pay_at_property"
              checked={selectedMode === "pay_at_property"}
              onChange={() => setSelectedMode("pay_at_property")}
              className="mt-1 size-4 shrink-0"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <span>
              <span className="block font-semibold">Pagar al llegar</span>
              <span className="block text-sm text-muted-foreground">
                Reserva ahora y paga al llegar a Vista Valle.
              </span>
            </span>
          </label>
        ) : null}
        {showMercadoPago ? (
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 shadow-md transition-colors ${
              selectedMode === "mercado_pago"
                ? "border-accent bg-accent/10"
                : "border-transparent bg-card hover:border-border"
            }`}
          >
            <input
              type="radio"
              name="paymentMode"
              value="mercado_pago"
              checked={selectedMode === "mercado_pago"}
              onChange={() => setSelectedMode("mercado_pago")}
              className="mt-1 size-4 shrink-0"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <span>
              <span className="block font-semibold">
                Tarjeta de crédito o débito
              </span>
              <span className="block text-sm text-muted-foreground">
                Paga ahora de forma segura con Mercado Pago.
              </span>
            </span>
          </label>
        ) : null}
        {showFintoc ? (
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 shadow-md transition-colors ${
              selectedMode === "fintoc"
                ? "border-accent bg-accent/10"
                : "border-transparent bg-card hover:border-border"
            }`}
          >
            <input
              type="radio"
              name="paymentMode"
              value="fintoc"
              checked={selectedMode === "fintoc"}
              onChange={() => setSelectedMode("fintoc")}
              className="mt-1 size-4 shrink-0"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <span>
              <span className="block font-semibold">Transferencia bancaria</span>
              <span className="block text-sm text-muted-foreground">
                Paga ahora de forma segura con Fintoc.
              </span>
            </span>
          </label>
        ) : null}
      </div>
      <Button
        type="button"
        className="w-full"
        loading={pending}
        disabled={pending}
        onClick={confirm}
      >
        Confirmar reserva
      </Button>
      <div aria-live="assertive">
        {error ? (
          <Feedback variant="error" title="No pudimos confirmar la reserva">
            {error}
          </Feedback>
        ) : null}
      </div>
    </div>
  );
}
