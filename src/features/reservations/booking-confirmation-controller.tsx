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
type FintocCheckoutResponse = Readonly<{
  redirectUrl: string;
  message?: string;
}>;

/**
 * Client-side wiring only; the server reconstructs every authoritative
 * value. `roomCount` gates the online-payment option: Fintoc checkout is
 * single-room only for this change (see design.md non-goals in
 * `add-fintoc-online-payment`), so with more than one room selected only
 * pago al llegar is offered.
 */
export function BookingConfirmationController({
  bookingEnabled,
  roomCount = 1,
}: Readonly<{ bookingEnabled: boolean; roomCount?: number }>) {
  const router = useRouter();
  const idempotencyKeyRef = useRef<string | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [pendingMode, setPendingMode] = useState<
    "pay_at_property" | "pay_now"
  >();
  const [selectedMode, setSelectedMode] = useState<
    "pay_at_property" | "pay_now"
  >("pay_at_property");

  const confirmPayAtProperty = async () => {
    setPendingMode("pay_at_property");
    setError(undefined);
    try {
      const query = new URLSearchParams(window.location.search);
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

  const confirmPayNow = async () => {
    setPendingMode("pay_now");
    setError(undefined);
    try {
      const query = new URLSearchParams(window.location.search);
      const response = await fetch("/api/bookings/fintoc-checkout", {
        body: JSON.stringify(Object.fromEntries(query)),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as FintocCheckoutResponse;
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
    if (selectedMode === "pay_now") return void confirmPayNow();
    return void confirmPayAtProperty();
  };

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
        {roomCount === 1 ? (
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 shadow-md transition-colors ${
              selectedMode === "pay_now"
                ? "border-accent bg-accent/10"
                : "border-transparent bg-card hover:border-border"
            }`}
          >
            <input
              type="radio"
              name="paymentMode"
              value="pay_now"
              checked={selectedMode === "pay_now"}
              onChange={() => setSelectedMode("pay_now")}
              className="mt-1 size-4 shrink-0"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <span>
              <span className="block font-semibold">Pagar online</span>
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
