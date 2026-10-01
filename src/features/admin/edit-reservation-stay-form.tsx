"use client";
import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

// eslint-disable-next-line architecture/feature-public-api -- client-safe boundary avoids server-only availability barrel.
import { nights } from "@/features/availability/client-date-only";
// eslint-disable-next-line architecture/feature-public-api -- the codec is deliberately client-safe; the reservations barrel reaches server-only data access.
import { serializeRoomSelectionParam } from "@/features/reservations/room-selection-codec";
import { Button } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";
import type {
  EditReservationStayActionResult,
  EditReservationStayFinancialSummary,
} from "./edit-reservation-stay-action";

const currency = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  style: "currency",
});

const controlClass =
  "min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";

export type StayEditRoomOption = Readonly<{
  capacity: number;
  id: string;
  name: string;
}>;

export type StayEditCurrentRoom = Readonly<{
  guestCount: number;
  roomId: string;
}>;

type AvailabilityState = "error" | "loading" | "ready";

/**
 * Edits a reservation's whole stay in one submit: the interval, the set of
 * rooms, and the occupancy of each room. Replaces the dates-only form, so
 * moving a date and swapping a room is a single edit with one
 * recalculation, one audit entry and one administrative email.
 *
 * The room list is re-read whenever the dates change, from a boundary that
 * excludes this reservation's own occupancy - so the rooms it already holds
 * stay selectable instead of appearing taken.
 */
export function EditReservationStayForm({
  action,
  channelConnectedRoomIds,
  checkIn: currentCheckIn,
  checkOut: currentCheckOut,
  currentRooms,
  externalChannelLabel,
  reservationId,
}: Readonly<{
  action: (data: FormData) => Promise<EditReservationStayActionResult>;
  /**
   * Rooms with an active channel connection. A resulting room outside this
   * set changes how the stay syncs with Airbnb and Booking, which the
   * administrator must see before confirming.
   */
  channelConnectedRoomIds?: readonly string[];
  checkIn: string;
  checkOut: string;
  currentRooms: readonly StayEditCurrentRoom[];
  /** Set when the reservation came from an external channel. */
  externalChannelLabel?: string;
  reservationId: string;
}>) {
  const router = useRouter();
  const formId = useId();
  const [checkIn, setCheckIn] = useState(currentCheckIn);
  const [checkOut, setCheckOut] = useState(currentCheckOut);
  const [selection, setSelection] = useState<readonly StayEditCurrentRoom[]>(
    () => currentRooms.map((room) => ({ ...room }))
  );
  const [rooms, setRooms] = useState<readonly StayEditRoomOption[]>([]);
  const [availability, setAvailability] =
    useState<AvailabilityState>("loading");
  const [availabilityError, setAvailabilityError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [financialSummary, setFinancialSummary] =
    useState<EditReservationStayFinancialSummary>();
  const { notify } = useToast();

  // The effect only writes state from its async callbacks; "loading" is set
  // by the date handlers, where the user's action originates.
  useEffect(() => {
    if (!checkIn || !checkOut) return;
    const controller = new AbortController();
    void fetch(
      `/api/admin/reservations/stay-availability?${new URLSearchParams({
        checkIn,
        checkOut,
        reservationId,
      })}`,
      {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      }
    )
      .then(async (response) => {
        const body = (await response.json()) as {
          message?: string;
          rooms?: readonly StayEditRoomOption[];
        };
        if (!response.ok) {
          setAvailability("error");
          setAvailabilityError(
            body.message ?? "No pudimos consultar disponibilidad."
          );
          return;
        }
        setRooms(body.rooms ?? []);
        setAvailability("ready");
        setAvailabilityError(undefined);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setAvailability("error");
        setAvailabilityError("No pudimos consultar disponibilidad.");
      });
    return () => controller.abort();
  }, [checkIn, checkOut, reservationId]);

  let newNights;
  try {
    newNights = checkIn && checkOut ? nights(checkIn, checkOut) : undefined;
  } catch {
    newNights = undefined;
  }

  const selectedIds = selection.map((room) => room.roomId);
  const guestCountOf = (roomId: string) =>
    selection.find((room) => room.roomId === roomId)?.guestCount ?? 1;

  const toggleRoom = (roomId: string, checked: boolean, capacity: number) => {
    setSelection((current) =>
      checked
        ? current.some((room) => room.roomId === roomId)
          ? current
          : [...current, { guestCount: Math.min(1, capacity), roomId }]
        : current.filter((room) => room.roomId !== roomId)
    );
  };

  const setGuestCount = (roomId: string, guestCount: number) => {
    setSelection((current) =>
      current.map((room) =>
        room.roomId === roomId ? { ...room, guestCount } : room
      )
    );
  };

  const removedRooms = currentRooms.filter(
    (room) => !selectedIds.includes(room.roomId)
  );
  const addedRoomIds = selectedIds.filter(
    (roomId) => !currentRooms.some((room) => room.roomId === roomId)
  );
  const roomSetChanged = removedRooms.length > 0 || addedRoomIds.length > 0;
  const disconnectedRooms = channelConnectedRoomIds
    ? selectedIds.filter((roomId) => !channelConnectedRoomIds.includes(roomId))
    : [];
  const nameOf = (roomId: string) =>
    rooms.find((room) => room.id === roomId)?.name ?? roomId;

  const submit = async () => {
    setPending(true);
    try {
      const data = new FormData();
      data.set("id", reservationId);
      data.set("checkIn", checkIn);
      data.set("checkOut", checkOut);
      data.set("rooms", serializeRoomSelectionParam(selection));
      const result = await action(data);
      if (result.ok) {
        setMessage("Estadía actualizada.");
        setFinancialSummary(result.financialSummary);
        notify("success", "Estadía actualizada.");
        router.refresh();
      } else {
        setMessage(result.message);
        setFinancialSummary(undefined);
        notify("error", result.message);
      }
    } catch {
      setMessage("No pudimos actualizar la estadía.");
      notify("error", "No pudimos actualizar la estadía.");
    } finally {
      setPending(false);
      setConfirming(false);
    }
  };

  const renderRooms = () => {
    if (availability === "loading")
      return (
        <p role="status" className="text-sm text-muted-foreground">
          Buscando habitaciones disponibles…
        </p>
      );
    if (availability === "error")
      return (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground"
        >
          {availabilityError}
        </p>
      );
    if (rooms.length === 0)
      return (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground"
        >
          No hay habitaciones disponibles para estas fechas.
        </p>
      );
    return (
      <div className="grid gap-2 tablet:grid-cols-2">
        {rooms.map((room) => {
          const isSelected = selectedIds.includes(room.id);
          return (
            <div
              key={room.id}
              className="flex min-h-14 items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm has-[:checked]:border-accent"
            >
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  checked={isSelected}
                  className="size-4"
                  onChange={(event) =>
                    toggleRoom(room.id, event.target.checked, room.capacity)
                  }
                  type="checkbox"
                  value={room.id}
                />
                <span>
                  <span className="block font-semibold text-foreground">
                    {room.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Capacidad: {room.capacity}
                  </span>
                </span>
              </label>
              {isSelected ? (
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  Huéspedes
                  <input
                    aria-label={`Huéspedes en ${room.name}`}
                    className="h-8 w-14 rounded-md border border-border bg-background px-2 text-center text-sm text-foreground"
                    max={room.capacity}
                    min={1}
                    onChange={(event) =>
                      setGuestCount(
                        room.id,
                        Math.min(
                          Math.max(1, Number(event.target.value) || 1),
                          room.capacity
                        )
                      )
                    }
                    type="number"
                    value={guestCountOf(room.id)}
                  />
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <form
      aria-label="Editar estadía de la reserva"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(undefined);
        setFinancialSummary(undefined);
        if (selection.length === 0) {
          const reason = "La reserva debe conservar al menos una habitación.";
          setMessage(reason);
          notify("error", reason);
          return;
        }
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
            onChange={(event) => {
              setAvailability("loading");
              setCheckIn(event.target.value);
            }}
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
            onChange={(event) => {
              setAvailability("loading");
              setCheckOut(event.target.value);
            }}
            required
            className={controlClass}
          />
        </label>
      </div>
      {newNights ? (
        <p className="text-sm text-muted-foreground">{newNights} noches</p>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          Habitaciones y personas
        </legend>
        {renderRooms()}
      </fieldset>

      {roomSetChanged && externalChannelLabel ? (
        <p
          role="status"
          className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          Cambiar las habitaciones de esta reserva no se refleja en{" "}
          {externalChannelLabel}: la plataforma externa no se entera del cambio.
        </p>
      ) : null}
      {roomSetChanged && disconnectedRooms.length > 0 ? (
        <p
          role="status"
          className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground"
        >
          {disconnectedRooms.length === 1
            ? `${nameOf(disconnectedRooms[0]!)} no tiene una conexión de canal activa: su disponibilidad no se sincronizará con Airbnb ni Booking.`
            : `Estas habitaciones no tienen una conexión de canal activa y su disponibilidad no se sincronizará con Airbnb ni Booking: ${disconnectedRooms
                .map((roomId) => nameOf(roomId))
                .join(", ")}.`}
        </p>
      ) : null}

      <Button type="submit" loading={pending}>
        Editar estadía
      </Button>
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {financialSummary ? (
        <dl
          aria-label="Resultado financiero de la estadía"
          role="group"
          className="grid gap-1 rounded-lg border border-border bg-background p-3 text-sm"
        >
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Total recalculado</dt>
            <dd className="font-semibold text-foreground">
              {currency.format(financialSummary.totalClp)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Saldo pendiente</dt>
            <dd className="font-semibold text-foreground">
              {currency.format(financialSummary.pendingBalanceClp)}
            </dd>
          </div>
          {financialSummary.overpaymentClp > 0 ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Sobrepago por resolver</dt>
              <dd className="font-semibold text-foreground">
                {currency.format(financialSummary.overpaymentClp)}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {confirming ? (
        <div
          role="dialog"
          aria-label="Confirmar edición de estadía"
          className="space-y-3 rounded-lg border border-border bg-background p-3"
        >
          <p className="text-sm font-medium text-foreground">
            ¿Confirmas cambiar la estadía a {checkIn} — {checkOut} con{" "}
            {selection.length}{" "}
            {selection.length === 1 ? "habitación" : "habitaciones"}? El total
            se recalculará con la tarifa vigente.
          </p>
          {removedRooms.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Se quitarán:{" "}
              {removedRooms.map((room) => nameOf(room.roomId)).join(", ")}.
            </p>
          ) : null}
          {addedRoomIds.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              Se agregarán: {addedRoomIds.map((id) => nameOf(id)).join(", ")}.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
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
              Confirmar cambio de estadía
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
