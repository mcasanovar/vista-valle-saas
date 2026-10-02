"use client";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";
import type { EditReservationNightlyRatesActionResult } from "./edit-reservation-nightly-rates-action";
import {
  isValidNightlyRateAmount,
  parseNightlyRateAmount,
} from "./nightly-rate-amount";

const controlClass =
  "min-h-11 w-full rounded-md border border-border bg-background px-3 text-right text-sm text-foreground";

const currency = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  style: "currency",
});

/** One room line of the reservation, as the detail already reads it. */
export type ReservationNightlyRateRoom = Readonly<{
  nightlyPriceClp: number;
  nightlyPriceManual: boolean;
  nights: number;
  roomId: string;
  roomName: string;
}>;

/**
 * Per-room nightly value editor for an external-channel reservation. Submits
 * only the per-room amounts; nights, subtotals and the total are recalculated
 * server-side, so nothing here is authoritative.
 *
 * An emptied field means "go back to the room's current rate" - the same
 * submission, with the value absent.
 */
export function EditReservationNightlyRatesForm({
  action,
  reservationId,
  rooms,
}: Readonly<{
  action: (data: FormData) => Promise<EditReservationNightlyRatesActionResult>;
  reservationId: string;
  rooms: readonly ReservationNightlyRateRoom[];
}>) {
  const router = useRouter();
  const formId = useId();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rooms.map((room) => [
        room.roomId,
        room.nightlyPriceManual ? String(room.nightlyPriceClp) : "",
      ])
    )
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const { notify } = useToast();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(undefined);
    setPending(true);
    try {
      const data = new FormData();
      data.set("id", reservationId);
      for (const room of rooms) {
        data.set(`rate:${room.roomId}`, values[room.roomId] ?? "");
      }
      const result = await action(data);
      if (result.ok) {
        const successMessage = "Valor por noche actualizado.";
        setMessage(successMessage);
        notify("success", successMessage);
        router.refresh();
      } else {
        setMessage(result.message);
        notify("error", result.message);
      }
    } catch {
      const failure = "No pudimos actualizar el valor por noche.";
      setMessage(failure);
      notify("error", failure);
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      aria-label="Editar valor por noche"
      onSubmit={(event) => void submit(event)}
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div>
        <h3 className="font-heading text-base font-bold">Valor por noche</h3>
        <p className="text-sm text-foreground/80">
          Registra lo que cobró el canal. Deja el campo vacío para volver a la
          tarifa vigente de la habitación.
        </p>
      </div>
      <ul className="space-y-3">
        {rooms.map((room) => {
          const raw = values[room.roomId] ?? "";
          const parsed = parseNightlyRateAmount(raw);
          const willBeManual = isValidNightlyRateAmount(parsed);
          const previewTotal = willBeManual
            ? parsed * room.nights
            : room.nightlyPriceClp * room.nights;
          return (
            <li key={room.roomId} className="space-y-1">
              <label
                htmlFor={`${formId}-${room.roomId}`}
                className="flex flex-col gap-1 text-sm font-semibold text-foreground"
              >
                {room.roomName}
                <input
                  className={controlClass}
                  id={`${formId}-${room.roomId}`}
                  inputMode="numeric"
                  name={`rate:${room.roomId}`}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [room.roomId]: event.target.value,
                    }))
                  }
                  placeholder="Tarifa vigente"
                  value={raw}
                />
              </label>
              <p className="text-xs text-foreground/80">
                {room.nightlyPriceManual ? (
                  <span data-testid={`manual-badge-${room.roomId}`}>
                    Valor fijado a mano:{" "}
                    {currency.format(room.nightlyPriceClp)} por noche.
                  </span>
                ) : (
                  <span data-testid={`rate-badge-${room.roomId}`}>
                    Tarifa vigente: {currency.format(room.nightlyPriceClp)} por
                    noche.
                  </span>
                )}{" "}
                {room.nights} {room.nights === 1 ? "noche" : "noches"} ·{" "}
                {currency.format(previewTotal)}
              </p>
            </li>
          );
        })}
      </ul>
      {message ? (
        <p aria-live="polite" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Guardando…" : "Guardar valor por noche"}
      </Button>
    </form>
  );
}
