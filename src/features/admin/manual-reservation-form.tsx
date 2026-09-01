"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// eslint-disable-next-line architecture/feature-public-api -- the public availability barrel reaches server-only data access.
import { nights as calculateNights } from "@/features/availability/client-date-only";
import { useToast } from "@/presentation/organisms";
import type {
  ManualReservationActionField,
  ManualReservationActionResult,
} from "./manual-reservation-action";
import type { ManualReservationInitialData } from "./manual-reservation-data";
import {
  manualOrigins,
  manualReservationDateMinimums,
  validateManualReservationDateRange,
} from "./manual-reservation-contract";

type AvailableRoom = Readonly<{
  capacity: number;
  id: string;
  name: string;
  nightlyPriceClp: number;
}>;
type FieldName = ManualReservationActionField | "form" | "invoice";
type FormErrors = Partial<Record<FieldName | "form", string>>;

const currency = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  style: "currency",
});

const originLabels: Record<(typeof manualOrigins)[number], string> = {
  admin: "Administración",
  airbnb: "Airbnb",
  booking: "Booking.com",
  phone: "Teléfono",
  whatsapp: "WhatsApp",
};

function AvailabilitySkeleton() {
  return (
    <div aria-busy="true" className="space-y-3" data-testid="room-skeleton">
      <p
        role="status"
        aria-label="Cargando habitaciones disponibles"
        className="sr-only"
      >
        Cargando habitaciones disponibles
      </p>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="admin-dashboard-shimmer h-14 rounded-lg"
        />
      ))}
    </div>
  );
}

function ErrorMessage({
  id,
  message,
}: Readonly<{ id: string; message?: string }>) {
  return message ? (
    <p id={id} role="alert" className="mt-1.5 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

const controlClass =
  "mt-1.5 block min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function ManualReservationForm({
  action,
  initialData,
  initialSelection,
}: Readonly<{
  action: (data: FormData) => Promise<ManualReservationActionResult>;
  initialData: ManualReservationInitialData;
  /** Prefills the calendar's quick-create flow (room + date), see admin-reservation-calendar spec. */
  initialSelection?: Readonly<{
    roomId?: string;
    checkIn?: string;
    checkOut?: string;
  }>;
}>) {
  const [checkIn, setCheckIn] = useState(initialSelection?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initialSelection?.checkOut ?? "");
  const [availableRooms, setAvailableRooms] = useState<
    readonly AvailableRoom[]
  >([]);
  const [selectedRoomIds, setSelectedRoomIds] = useState<readonly string[]>(
    initialSelection?.roomId ? [initialSelection.roomId] : []
  );
  const [availabilityState, setAvailabilityState] = useState<
    "dates_required" | "loading" | "ready" | "error"
  >(initialData.availability.status);
  const [availabilityError, setAvailabilityError] = useState<string>();
  const [invoiceRequested, setInvoiceRequested] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const { notify } = useToast();
  const dateMinimums = useMemo(() => manualReservationDateMinimums(), []);

  useEffect(() => {
    if (Object.keys(errors).length) errorSummary.current?.focus();
  }, [errors]);
  useEffect(() => {
    if (!checkIn || !checkOut) return;
    const controller = new AbortController();
    void fetch(
      `/api/admin/manual-reservations/availability?${new URLSearchParams({ checkIn, checkOut })}`,
      {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as Readonly<{
          rooms: readonly AvailableRoom[];
        }>;
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setAvailableRooms(result.rooms);
          setAvailabilityState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAvailabilityState("error");
          setAvailabilityError(
            "No pudimos consultar las habitaciones. Revisa las fechas e inténtalo nuevamente."
          );
        }
      });
    return () => controller.abort();
  }, [checkIn, checkOut]);
  const updateDate = (field: "checkIn" | "checkOut", value: string) => {
    const nextCheckIn = field === "checkIn" ? value : checkIn;
    const nextCheckOut = field === "checkOut" ? value : checkOut;
    if (field === "checkIn") setCheckIn(value);
    else setCheckOut(value);
    setAvailableRooms([]);
    setSelectedRoomIds([]);
    setAvailabilityError(undefined);
    setAvailabilityState(
      nextCheckIn && nextCheckOut ? "loading" : "dates_required"
    );
  };

  const validate = (data: FormData): FormErrors => {
    const next: FormErrors = {};
    const rawCheckIn = String(data.get("checkIn") ?? "");
    const rawCheckOut = String(data.get("checkOut") ?? "");
    if (!rawCheckIn) next.checkIn = "Indica la fecha de entrada.";
    if (!rawCheckOut) next.checkOut = "Indica la fecha de salida.";
    if (rawCheckIn && rawCheckOut) {
      for (const dateError of validateManualReservationDateRange(
        rawCheckIn,
        rawCheckOut
      )) {
        next[dateError.field] = dateError.message;
      }
    }
    if (!data.getAll("roomIds").length)
      next.roomIds = "Selecciona al menos una habitación disponible.";
    if (!String(data.get("email") ?? "").trim())
      next.email = "Indica un correo electrónico.";
    if (
      invoiceRequested &&
      [
        "invoiceName",
        "invoiceRut",
        "invoicePhone",
        "invoiceBusinessActivity",
        "invoiceEmail",
      ].some((field) => !String(data.get(field) ?? "").trim())
    )
      next.invoice = "Completa todos los datos de facturación.";
    return next;
  };
  const submit = async (data: FormData) => {
    const nextErrors = validate(data);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setPending(true);
    setMessage(undefined);
    try {
      const result = await action(data);
      if (!result.ok) {
        setErrors({
          form: result.message,
          ...Object.fromEntries(
            result.fieldErrors.map(({ field, message }) => [field, message])
          ),
        });
        notify("error", result.message);
        return;
      }
      const successMessage =
        "Reserva creada. El pago queda pendiente para cobro al llegar.";
      setMessage(successMessage);
      notify("success", successMessage);
    } catch {
      const failureMessage =
        "No pudimos crear la reserva. Revisa las fechas y disponibilidad antes de intentarlo nuevamente.";
      setErrors({ form: failureMessage });
      notify("error", failureMessage);
    } finally {
      setPending(false);
    }
  };
  const toggleRoom = (roomId: string, selected: boolean) => {
    setSelectedRoomIds((current) =>
      selected
        ? [...current, roomId]
        : current.filter((selectedRoomId) => selectedRoomId !== roomId)
    );
  };
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Calling submit directly (not via startTransition) keeps the pending
    // spinner from being coalesced away when the action resolves quickly:
    // React can otherwise skip an intermediate transition render entirely.
    void submit(new FormData(event.currentTarget));
  };
  const pricingSummary = () => {
    if (
      availabilityState !== "ready" ||
      !selectedRoomIds.length ||
      !checkIn ||
      !checkOut
    )
      return null;
    let nightsCount: number;
    try {
      nightsCount = calculateNights(checkIn, checkOut);
    } catch {
      return null;
    }
    const selectedRooms = availableRooms.filter((room) =>
      selectedRoomIds.includes(room.id)
    );
    const total = selectedRooms.reduce(
      (sum, room) => sum + room.nightlyPriceClp * nightsCount,
      0
    );
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <p className="font-semibold text-foreground">
          Resumen de tarifa ({nightsCount}{" "}
          {nightsCount === 1 ? "noche" : "noches"})
        </p>
        <ul className="mt-2 space-y-1">
          {selectedRooms.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between text-muted-foreground"
            >
              <span>{room.name}</span>
              <span>{currency.format(room.nightlyPriceClp * nightsCount)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-bold text-foreground">
          <span>Total</span>
          <span>{currency.format(total)}</span>
        </p>
      </div>
    );
  };
  const roomSection = () => {
    if (availabilityState === "loading") return <AvailabilitySkeleton />;
    if (availabilityState === "dates_required")
      return (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          {initialData.rooms.length} habitaciones elegibles. Selecciona entrada
          y salida para consultar las disponibles.
        </p>
      );
    if (availabilityState === "error")
      return (
        <p role="alert" className="text-sm text-destructive">
          {availabilityError}
        </p>
      );
    if (!availableRooms.length)
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
        {availableRooms.map((room) => (
          <label
            key={room.id}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-[var(--admin-accent-background,#eef0fb)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
          >
            <input
              checked={selectedRoomIds.includes(room.id)}
              className="size-4 accent-[var(--admin-accent)]"
              name="roomIds"
              onChange={(event) => toggleRoom(room.id, event.target.checked)}
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
        ))}
      </div>
    );
  };
  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Crear reserva manual"
      className="space-y-5 rounded-xl border border-border bg-card p-4 tablet:p-5"
    >
      {Object.keys(errors).length ? (
        <div
          ref={errorSummary}
          tabIndex={-1}
          role="alert"
          aria-labelledby="manual-reservation-errors"
          className="rounded-lg border border-destructive bg-[var(--admin-reservation-cancelled-background)] p-3 text-sm text-destructive"
        >
          <h2 id="manual-reservation-errors" className="font-bold">
            Revisa los datos de la reserva
          </h2>
          <ul className="mt-1 list-inside list-disc">
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <fieldset className="space-y-3">
        <legend className="font-heading text-base font-bold">
          Fechas y habitaciones
        </legend>
        <div className="grid gap-4 tablet:grid-cols-2">
          <label className="text-sm font-semibold">
            Entrada
            <input
              aria-describedby={errors.checkIn ? "checkIn-error" : undefined}
              className={controlClass}
              min={dateMinimums.checkIn}
              name="checkIn"
              onChange={(event) => updateDate("checkIn", event.target.value)}
              required
              type="date"
              value={checkIn}
            />
          </label>
          <label className="text-sm font-semibold">
            Salida
            <input
              aria-describedby={errors.checkOut ? "checkOut-error" : undefined}
              className={controlClass}
              min={dateMinimums.checkOut}
              name="checkOut"
              onChange={(event) => updateDate("checkOut", event.target.value)}
              required
              type="date"
              value={checkOut}
            />
          </label>
        </div>
        <ErrorMessage id="checkIn-error" message={errors.checkIn} />
        <ErrorMessage id="checkOut-error" message={errors.checkOut} />
        <div aria-describedby={errors.roomIds ? "roomIds-error" : undefined}>
          {roomSection()}
        </div>
        {availabilityState === "ready" ? (
          <p
            aria-live="polite"
            className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
          >
            <span className="font-semibold text-foreground">
              Habitaciones seleccionadas: {selectedRoomIds.length}
            </span>
            {selectedRoomIds.length
              ? ` — ${availableRooms
                  .filter((room) => selectedRoomIds.includes(room.id))
                  .map((room) => room.name)
                  .join(", ")}`
              : "."}
          </p>
        ) : null}
        <ErrorMessage id="roomIds-error" message={errors.roomIds} />
        {pricingSummary()}
      </fieldset>
      <fieldset className="grid gap-4 tablet:grid-cols-2">
        <legend className="font-heading col-span-full text-base font-bold">
          Origen y huésped
        </legend>
        <label className="text-sm font-semibold">
          Origen
          <select
            aria-describedby={errors.origin ? "origin-error" : undefined}
            className={controlClass}
            defaultValue="admin"
            name="origin"
          >
            {manualOrigins.map((origin) => (
              <option key={origin} value={origin}>
                {originLabels[origin]}
              </option>
            ))}
          </select>
          <ErrorMessage id="origin-error" message={errors.origin} />
        </label>
        <label className="text-sm font-semibold">
          Cantidad de huéspedes
          <input
            aria-describedby={
              errors.guestCount ? "guestCount-error" : undefined
            }
            className={controlClass}
            defaultValue="1"
            min="1"
            name="guestCount"
            required
            type="number"
          />
          <ErrorMessage id="guestCount-error" message={errors.guestCount} />
        </label>
        <label className="text-sm font-semibold">
          Nombre
          <input
            aria-describedby={errors.firstName ? "firstName-error" : undefined}
            className={controlClass}
            name="firstName"
            required
          />
          <ErrorMessage id="firstName-error" message={errors.firstName} />
        </label>
        <label className="text-sm font-semibold">
          Apellido
          <input
            aria-describedby={errors.lastName ? "lastName-error" : undefined}
            className={controlClass}
            name="lastName"
            required
          />
          <ErrorMessage id="lastName-error" message={errors.lastName} />
        </label>
        <label className="text-sm font-semibold">
          Correo electrónico
          <input
            aria-describedby={errors.email ? "email-error" : undefined}
            autoComplete="email"
            className={controlClass}
            name="email"
            required
            type="email"
          />
        </label>
        <label className="text-sm font-semibold">
          Teléfono
          <input
            aria-describedby={errors.phone ? "phone-error" : undefined}
            autoComplete="tel"
            className={controlClass}
            name="phone"
            required
            type="tel"
          />
          <ErrorMessage id="phone-error" message={errors.phone} />
        </label>
        <ErrorMessage id="email-error" message={errors.email} />
        <label className="text-sm font-semibold tablet:col-span-2">
          Comentario (opcional)
          <textarea
            className={`${controlClass} min-h-24 py-2`}
            name="comment"
          />
        </label>
      </fieldset>
      <fieldset className="space-y-3 border-t border-border pt-5">
        <legend className="font-heading text-base font-bold">Factura</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold has-[:focus-visible]:rounded-lg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
          <input
            checked={invoiceRequested}
            className="size-4 accent-[var(--admin-accent)]"
            name="invoiceRequested"
            onChange={(event) => setInvoiceRequested(event.target.checked)}
            type="checkbox"
            value="true"
          />{" "}
          Solicitar factura
        </label>
        {invoiceRequested ? (
          <div className="grid gap-4 tablet:grid-cols-2">
            <label className="text-sm font-semibold">
              Razón social
              <input className={controlClass} name="invoiceName" required />
            </label>
            <label className="text-sm font-semibold">
              RUT
              <input className={controlClass} name="invoiceRut" required />
            </label>
            <label className="text-sm font-semibold">
              Teléfono de facturación
              <input
                className={controlClass}
                name="invoicePhone"
                required
                type="tel"
              />
            </label>
            <label className="text-sm font-semibold">
              Giro
              <input
                className={controlClass}
                name="invoiceBusinessActivity"
                required
              />
            </label>
            <label className="text-sm font-semibold tablet:col-span-2">
              Correo de facturación
              <input
                className={controlClass}
                name="invoiceEmail"
                required
                type="email"
              />
            </label>
          </div>
        ) : null}
        <ErrorMessage id="invoice-error" message={errors.invoice} />
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          La tarifa y el estado se calcularán en el servidor. Pago al llegar.
        </p>
        <button
          disabled={pending || availabilityState !== "ready"}
          className="inline-flex min-h-11 scroll-mb-[calc(5.75rem+env(safe-area-inset-bottom))] items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-70"
          onFocus={(event) =>
            event.currentTarget.scrollIntoView({
              block: "center",
              inline: "nearest",
            })
          }
          type="submit"
        >
          {pending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {pending ? "Creando reserva…" : "Crear reserva"}
        </button>
      </div>
      {message ? (
        <p
          role="status"
          className="text-sm font-semibold text-[var(--admin-success)]"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
