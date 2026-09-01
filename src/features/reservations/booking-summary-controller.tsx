"use client";
import { useState } from "react";
import { Button, Feedback } from "@/presentation/atoms";
import { Price } from "@/presentation/molecules";
import {
  publicApiResponseError,
  safePublicErrorMessage,
} from "@/presentation/public-api-message";
import { BookingConfirmationController } from "./booking-confirmation-controller";
type Summary = {
  checkIn: string;
  checkOut: string;
  guestCount: number;
  room: { name: string };
  pricing: {
    nights: number;
    nightlyPriceClp: number;
    chargesClp: number;
    totalClp: number;
  };
};
export function BookingSummaryController() {
  const [summary, setSummary] = useState<Summary>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const load = async () => {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/booking-summary?${new URLSearchParams(window.location.search)}`
      );
      const body = (await response.json()) as Summary & { message?: string };
      if (!response.ok)
        throw publicApiResponseError(body, "No pudimos preparar el resumen.");
      setSummary(body);
    } catch (cause) {
      setError(
        safePublicErrorMessage(cause, "No pudimos preparar el resumen.")
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <section
      aria-label="Resumen de reserva"
      className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <h2 className="font-heading text-title text-foreground">
        Resumen de tu estadía
      </h2>
      <Button type="button" loading={pending} onClick={() => void load()}>
        Ver resumen
      </Button>
      <div aria-live="polite">
        {error ? (
          <Feedback variant="error" title="Revisa tus datos">
            {error}
          </Feedback>
        ) : null}
        {summary ? (
          <>
            <dl className="grid gap-2 tablet:grid-cols-2">
              <div>
                <dt>Habitación</dt>
                <dd>{summary.room.name}</dd>
              </div>
              <div>
                <dt>Entrada</dt>
                <dd>{summary.checkIn}</dd>
              </div>
              <div>
                <dt>Salida</dt>
                <dd>{summary.checkOut}</dd>
              </div>
              <div>
                <dt>Huéspedes</dt>
                <dd>{summary.guestCount}</dd>
              </div>
              <div>
                <dt>Noches</dt>
                <dd>{summary.pricing.nights}</dd>
              </div>
              <div>
                <dt>Tarifa nocturna</dt>
                <dd>
                  <Price amount={summary.pricing.nightlyPriceClp} />
                </dd>
              </div>
              <div>
                <dt>Cargos</dt>
                <dd>
                  <Price amount={summary.pricing.chargesClp} />
                </dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>
                  <Price amount={summary.pricing.totalClp} />
                </dd>
              </div>
            </dl>
            {/* Legacy single-room flow, superseded by PrebookingReviewController and currently unreachable (see app/page.tsx). */}
            <BookingConfirmationController bookingEnabled />
          </>
        ) : null}
      </div>
    </section>
  );
}
