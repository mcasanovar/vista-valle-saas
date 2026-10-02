"use client";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";
import type { EditReservationOriginActionResult } from "./edit-reservation-origin-action";

const controlClass =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground";

/** Every origin a reservation can be corrected to, with its display label. */
const originOptions = [
  { label: "Sitio web", value: "website" },
  { label: "Airbnb", value: "airbnb" },
  { label: "Booking.com", value: "booking" },
  { label: "Teléfono", value: "phone" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Administración", value: "admin" },
] as const;

const externalChannels = new Set(["airbnb", "booking"]);

/**
 * Corrects which origin a reservation is attributed to, for an entry mistake.
 * Offered on every reservation and for all six origins.
 *
 * When the chosen origin is not an external channel and the reservation carries
 * a hand-set nightly value, that value is dropped and the stay is repriced from
 * the rooms' current rates - so the form says so before the administrator
 * confirms, rather than letting the total move unannounced.
 */
export function EditReservationOriginForm({
  action,
  currentOrigin,
  hasManualNightlyRate,
  reservationId,
}: Readonly<{
  action: (data: FormData) => Promise<EditReservationOriginActionResult>;
  currentOrigin: string;
  /** Whether any room line carries a hand-set nightly value. */
  hasManualNightlyRate: boolean;
  reservationId: string;
}>) {
  const router = useRouter();
  const formId = useId();
  const [origin, setOrigin] = useState(currentOrigin);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const { notify } = useToast();

  const willDropManualRate =
    hasManualNightlyRate && !externalChannels.has(origin);
  const leavesWebsite = currentOrigin === "website" && origin !== "website";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(undefined);
    setPending(true);
    try {
      const data = new FormData();
      data.set("id", reservationId);
      data.set("origin", origin);
      const result = await action(data);
      if (result.ok) {
        const successMessage = willDropManualRate
          ? "Origen corregido. El valor por noche volvió a la tarifa vigente."
          : "Origen corregido.";
        setMessage(successMessage);
        notify("success", successMessage);
        router.refresh();
      } else {
        setMessage(result.message);
        notify("error", result.message);
      }
    } catch {
      const failure = "No pudimos corregir el origen.";
      setMessage(failure);
      notify("error", failure);
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      aria-label="Corregir origen"
      onSubmit={(event) => void submit(event)}
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div>
        <h3 className="font-heading text-base font-bold">Origen</h3>
        <p className="text-sm text-foreground/80">
          Corrige el origen si la reserva se ingresó con el equivocado. No
          cambia fechas, habitaciones ni estado.
        </p>
      </div>
      <label
        htmlFor={`${formId}-origin`}
        className="flex flex-col gap-1 text-sm font-semibold text-foreground"
      >
        Origen de la reserva
        <select
          className={controlClass}
          id={`${formId}-origin`}
          name="origin"
          onChange={(event) => setOrigin(event.target.value)}
          value={origin}
        >
          {originOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {willDropManualRate ? (
        <p
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
          data-testid="drop-manual-rate-warning"
        >
          Este origen no admite un valor por noche propio: al guardar, el valor
          fijado a mano se descarta, la habitación vuelve a su tarifa vigente y
          el total y los pagos se recalculan.
        </p>
      ) : null}
      {leavesWebsite ? (
        <p
          className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
          data-testid="leaves-website-warning"
        >
          Esta reserva la creó el huésped en el sitio web. Cambiar su origen
          reatribuye su pago en el desglose por canal del resumen mensual.
        </p>
      ) : null}
      {message ? (
        <p aria-live="polite" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}
      <Button disabled={pending || origin === currentOrigin} type="submit">
        {pending ? "Guardando…" : "Corregir origen"}
      </Button>
    </form>
  );
}
