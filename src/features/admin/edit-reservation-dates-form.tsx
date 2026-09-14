"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";

// eslint-disable-next-line architecture/feature-public-api -- client-safe boundary avoids server-only availability barrel.
import { nights } from "@/features/availability/client-date-only";
import { Button } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";
import type { EditReservationDatesActionResult } from "./edit-reservation-dates-action";

const controlClass =
  "min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";

export function EditReservationDatesForm({
  action,
  checkIn: currentCheckIn,
  checkOut: currentCheckOut,
  reservationId,
}: Readonly<{
  action: (data: FormData) => Promise<EditReservationDatesActionResult>;
  checkIn: string;
  checkOut: string;
  reservationId: string;
}>) {
  const router = useRouter();
  const formId = useId();
  const [checkIn, setCheckIn] = useState(currentCheckIn);
  const [checkOut, setCheckOut] = useState(currentCheckOut);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const { notify } = useToast();

  let newNights;
  try {
    newNights = checkIn && checkOut ? nights(checkIn, checkOut) : undefined;
  } catch {
    newNights = undefined;
  }

  const submit = async () => {
    setPending(true);
    try {
      const data = new FormData();
      data.set("id", reservationId);
      data.set("checkIn", checkIn);
      data.set("checkOut", checkOut);
      const result = await action(data);
      if (result.ok) {
        setMessage("Fechas actualizadas.");
        notify("success", "Fechas actualizadas.");
        router.refresh();
      } else {
        setMessage(result.message);
        notify("error", result.message);
      }
    } catch {
      setMessage("No pudimos actualizar las fechas.");
      notify("error", "No pudimos actualizar las fechas.");
    } finally {
      setPending(false);
      setConfirming(false);
    }
  };

  return (
    <form
      aria-label="Editar fechas de la reserva"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(undefined);
        setConfirming(true);
      }}
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="grid gap-3 phone:grid-cols-2">
        <label
          htmlFor={`${formId}-check-in`}
          className="flex flex-col gap-1 text-sm font-medium text-foreground"
        >
          Nueva entrada
          <input
            id={`${formId}-check-in`}
            type="date"
            name="checkIn"
            value={checkIn}
            onChange={(event) => setCheckIn(event.target.value)}
            required
            className={controlClass}
          />
        </label>
        <label
          htmlFor={`${formId}-check-out`}
          className="flex flex-col gap-1 text-sm font-medium text-foreground"
        >
          Nueva salida
          <input
            id={`${formId}-check-out`}
            type="date"
            name="checkOut"
            value={checkOut}
            onChange={(event) => setCheckOut(event.target.value)}
            required
            className={controlClass}
          />
        </label>
      </div>
      {newNights ? (
        <p className="text-sm text-muted-foreground">{newNights} noches</p>
      ) : null}
      <Button type="submit" loading={pending}>
        Editar fechas
      </Button>
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {confirming ? (
        <div
          role="dialog"
          aria-label="Confirmar edición de fechas"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3"
        >
          <p className="text-sm font-medium text-foreground">
            ¿Confirmas cambiar la estadía a {checkIn} — {checkOut}? El total se
            recalculará con la tarifa vigente.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            loading={pending}
            onClick={() => void submit()}
          >
            Confirmar cambio de fechas
          </Button>
        </div>
      ) : null}
    </form>
  );
}
