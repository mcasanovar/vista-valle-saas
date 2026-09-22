"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button, Feedback, Heading, Label, Text } from "@/presentation/atoms";
import { FormField, Price } from "@/presentation/molecules";
import {
  publicApiResponseError,
  safePublicErrorMessage,
} from "@/presentation/public-api-message";
// Reuses the reservation flow's guest-distribution rules so the quotation
// form enforces the exact same per-room capacity and total-guest blocking.
// Imported from the deep module path (not the feature's public barrel)
// because the barrel also re-exports server-only reservation modules, which
// would otherwise get pulled into this client bundle.
// eslint-disable-next-line architecture/feature-public-api, architecture/presentation-boundaries
import {
  computeGuestAllocation,
  describeGuestAllocation,
  isOccupancySelectable,
} from "@/features/reservations/guest-allocation";
// eslint-disable-next-line architecture/feature-public-api, architecture/presentation-boundaries
import type { RoomOccupancySelection } from "@/features/reservations/room-selection-codec";
// Resolves the same occupancy-based nightly price the server uses to
// calculate the quotation, so the displayed price updates with the guest
// count instead of staying frozen at the room's flat rate.
// eslint-disable-next-line architecture/feature-public-api, architecture/presentation-boundaries
import { resolveDisplayRoomNightlyPrice } from "@/features/rooms/occupancy-pricing";
// eslint-disable-next-line architecture/feature-public-api, architecture/presentation-boundaries
import type { RoomOccupancyPrice } from "@/features/rooms/read-model";
import { CompanyQuotationConfirmationModal } from "./company-quotation-confirmation-modal";

type AvailableRoomOption = Readonly<{
  availableUnits: number;
  capacity: number;
  name: string;
  nightlyPriceClp: number;
  occupancyPrices: readonly RoomOccupancyPrice[];
  slug: string;
}>;

type BreakfastCatalog = Readonly<{
  description: string;
  unitPriceClp: number;
}>;

type FormValues = Readonly<{
  breakfastQuantity: string;
  breakfastRequested: boolean;
  company: string;
  contact: string;
  email: string;
  message: string;
  phone: string;
  requireParking: boolean | undefined;
}>;

const initialValues: FormValues = {
  breakfastQuantity: "",
  breakfastRequested: false,
  company: "",
  contact: "",
  email: "",
  message: "",
  phone: "",
  requireParking: undefined,
};

function formatCapacity(value: number) {
  return `${value} ${value === 1 ? "persona" : "personas"}`;
}

function formatUnits(value: number) {
  return `${value} ${value === 1 ? "disponible" : "disponibles"}`;
}

function selectableOccupanciesUpTo(capacity: number) {
  return Array.from({ length: Math.max(0, capacity) }, (_, index) => index + 1);
}

export function CompanyQuotationForm({
  breakfast,
  checkIn,
  checkOut,
  guestCount,
  rooms,
}: Readonly<{
  breakfast: BreakfastCatalog | null;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  rooms: readonly AvailableRoomOption[];
}>) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [guestCounts, setGuestCounts] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  const selectedRooms = useMemo(
    () => rooms.filter((room) => (guestCounts[room.slug] ?? 0) > 0),
    [guestCounts, rooms]
  );
  const selections: readonly RoomOccupancySelection[] = useMemo(
    () =>
      selectedRooms.map((room) => ({
        guestCount: guestCounts[room.slug] ?? 0,
        roomId: room.slug,
      })),
    [guestCounts, selectedRooms]
  );
  const allocation = computeGuestAllocation(guestCount, selections);

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setStatus("idle");
  }

  function selectRoom(slug: string) {
    setGuestCounts((current) => ({ ...current, [slug]: 1 }));
    setErrors((current) => ({ ...current, rooms: "" }));
    setStatus("idle");
  }

  function removeRoom(slug: string) {
    setGuestCounts((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
    setErrors((current) => ({ ...current, rooms: "" }));
    setStatus("idle");
  }

  function setRoomGuestCount(slug: string, value: number) {
    setGuestCounts((current) => ({ ...current, [slug]: value }));
    setErrors((current) => ({ ...current, rooms: "" }));
    setStatus("idle");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    const nextErrors: Record<string, string> = {};
    if (!values.company) nextErrors.company = "Este campo es obligatorio.";
    if (!values.contact) nextErrors.contact = "Este campo es obligatorio.";
    if (!/^\S+@\S+\.\S+$/.test(values.email))
      nextErrors.email = "Ingrese un correo válido.";
    if (!selectedRooms.length) {
      nextErrors.rooms = "Seleccione al menos una habitación.";
    } else if (!allocation.isComplete) {
      nextErrors.rooms = describeGuestAllocation(allocation);
    }
    if (values.requireParking === undefined)
      nextErrors.requireParking = "Este campo es obligatorio.";
    const breakfastQuantity = Number(values.breakfastQuantity);
    if (
      values.breakfastRequested &&
      (!Number.isSafeInteger(breakfastQuantity) || breakfastQuantity < 1)
    ) {
      nextErrors.breakfastQuantity = "Indique una cantidad válida.";
    }
    if (!values.message) nextErrors.message = "Este campo es obligatorio.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrors({});
    try {
      const response = await fetch("/api/company-quotations", {
        body: JSON.stringify({
          ...values,
          breakfastQuantity: values.breakfastRequested
            ? breakfastQuantity
            : undefined,
          checkIn,
          checkOut,
          guestCount,
          rooms: selectedRooms.map((room) => ({
            guestCount: guestCounts[room.slug],
            quantity: 1,
            slug: room.slug,
          })),
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        lines?: readonly unknown[];
        message?: string;
        nights?: number;
        totalClp?: number;
      };
      if (
        !response.ok ||
        !body.lines ||
        body.nights === undefined ||
        body.totalClp === undefined
      ) {
        throw publicApiResponseError(
          body,
          "No pudimos preparar la cotización."
        );
      }
      setStatus("success");
    } catch (error) {
      setErrors({
        form: safePublicErrorMessage(
          error,
          "No pudimos preparar la cotización."
        ),
      });
      setStatus("error");
    }
  }

  return (
    <>
      <form
        aria-label="Formulario de cotización para empresas"
        noValidate
        onSubmit={submit}
        className="space-y-8"
      >
        <section
          aria-labelledby="quotation-stay-heading"
          className="vv-quotation-panel space-y-5"
        >
          <div>
            <h2
              id="quotation-stay-heading"
              className="font-heading text-title font-normal text-foreground"
            >
              Habitaciones disponibles
            </h2>
            <Text className="mt-2 text-muted-foreground">
              Elige la combinación de habitaciones que necesitas para tus
              fechas. Solo se muestran las habitaciones libres.
            </Text>
          </div>
          <div
            className="space-y-3"
            aria-describedby={
              errors.rooms ? "quotation-rooms-error" : undefined
            }
          >
            <div>
              <Heading level={3}>Habitaciones</Heading>
              <Text className="mt-1 text-sm text-muted-foreground">
                La capacidad máxima y las unidades disponibles se muestran antes
                de seleccionar.
              </Text>
            </div>
            <div className="grid gap-3 tablet:grid-cols-3">
              {rooms.map((room) => {
                const selectedGuestCount = guestCounts[room.slug] ?? 0;
                const selected = selectedGuestCount > 0;
                const canSelect = !selected && allocation.remainingGuests > 0;
                const displayedPrice = selected
                  ? resolveDisplayRoomNightlyPrice(
                      room,
                      room.occupancyPrices,
                      selectedGuestCount
                    )
                  : room.occupancyPrices.length
                    ? Math.min(
                        room.nightlyPriceClp,
                        ...room.occupancyPrices.map((entry) => entry.priceClp)
                      )
                    : room.nightlyPriceClp;
                return (
                  <div
                    key={room.slug}
                    className="vv-quotation-room-option space-y-3 rounded-lg border border-border p-4"
                  >
                    <div>
                      <h4 className="font-heading text-lg text-foreground">
                        {room.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Capacidad máxima: {formatCapacity(room.capacity)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatUnits(room.availableUnits)}
                      </p>
                      <Price amount={displayedPrice} suffix="/ noche" />
                    </div>
                    {selected ? (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                          Personas en esta habitación
                        </span>
                        <div
                          role="group"
                          aria-label={`Cantidad de personas para ${room.name}`}
                          className="flex flex-wrap gap-1 rounded-full border border-border bg-muted p-1"
                        >
                          {selectableOccupanciesUpTo(room.capacity).map(
                            (value) => {
                              const active = guestCounts[room.slug] === value;
                              const disabled =
                                !active &&
                                !isOccupancySelectable(
                                  guestCount,
                                  selections,
                                  room.slug,
                                  value
                                );
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  aria-pressed={active}
                                  disabled={disabled}
                                  onClick={() =>
                                    setRoomGuestCount(room.slug, value)
                                  }
                                  className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors ${
                                    active
                                      ? "bg-foreground text-background"
                                      : "text-muted-foreground"
                                  } disabled:cursor-not-allowed disabled:opacity-40`}
                                >
                                  {value}
                                </button>
                              );
                            }
                          )}
                        </div>
                        <Button
                          onClick={() => removeRoom(room.slug)}
                          type="button"
                          variant="secondary"
                          className="w-full"
                        >
                          Quitar habitación
                        </Button>
                      </div>
                    ) : (
                      <Button
                        aria-pressed={false}
                        disabled={!canSelect}
                        onClick={() => selectRoom(room.slug)}
                        type="button"
                        variant="secondary"
                        className="w-full"
                      >
                        Seleccionar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            <div
              aria-live="polite"
              className={`vv-quotation-capacity rounded-md border p-4 ${allocation.isComplete ? "border-border bg-muted" : "border-destructive bg-destructive/10"}`}
            >
              <p className="font-semibold">{describeGuestAllocation(allocation)}</p>
              {!allocation.isComplete ? (
                <p
                  id="quotation-rooms-error"
                  role="alert"
                  className="mt-1 text-sm text-destructive"
                >
                  Debes asignar exactamente {formatCapacity(guestCount)} en
                  las habitaciones seleccionadas antes de poder enviar la
                  cotización.
                </p>
              ) : null}
            </div>
            {errors.rooms ? (
              <p role="alert" className="text-body text-destructive">
                {errors.rooms}
              </p>
            ) : null}
            {!selectedRooms.length ? (
              <p className="text-sm text-foreground">
                Selecciona una o más habitaciones para continuar con tu
                cotización.
              </p>
            ) : null}
          </div>
        </section>

        {selectedRooms.length ? (
          <section
            aria-labelledby="quotation-contact-heading"
            className="vv-quotation-panel space-y-5"
          >
            <div>
              <h2
                id="quotation-contact-heading"
                className="font-heading text-title font-normal text-foreground"
              >
                Datos de la empresa
              </h2>
              <Text className="mt-2 text-muted-foreground">
                Usaremos estos datos para enviar el resumen calculado de tu
                cotización.
              </Text>
            </div>
            <div className="grid gap-5 tablet:grid-cols-2">
              <FormField
                id="quotation-company"
                label="Empresa"
                required
                error={errors.company}
                inputProps={{
                  autoComplete: "organization",
                  onChange: (event) => update("company", event.target.value),
                  value: values.company,
                }}
              />
              <FormField
                id="quotation-contact"
                label="Persona de contacto"
                required
                error={errors.contact}
                inputProps={{
                  autoComplete: "name",
                  onChange: (event) => update("contact", event.target.value),
                  value: values.contact,
                }}
              />
              <FormField
                id="quotation-email"
                label="Correo electrónico"
                required
                error={errors.email}
                inputProps={{
                  autoComplete: "email",
                  onChange: (event) => update("email", event.target.value),
                  type: "email",
                  value: values.email,
                }}
              />
              <FormField
                id="quotation-phone"
                label="Teléfono"
                hint="Opcional"
                inputProps={{
                  autoComplete: "tel",
                  onChange: (event) => update("phone", event.target.value),
                  type: "tel",
                  value: values.phone,
                }}
              />
            </div>
            <div
              className="space-y-2"
              aria-describedby={
                errors.requireParking ? "quotation-parking-error" : undefined
              }
            >
              <Label id="quotation-parking-label" required>
                ¿Requiere estacionamiento?
              </Label>
              <div
                className="flex gap-3"
                role="group"
                aria-labelledby="quotation-parking-label"
                id="quotation-parking"
              >
                <Button
                  id="quotation-parking-yes"
                  aria-pressed={values.requireParking === true}
                  onClick={() => update("requireParking", true)}
                  type="button"
                  variant={
                    values.requireParking === true ? "primary" : "secondary"
                  }
                >
                  Sí
                </Button>
                <Button
                  aria-pressed={values.requireParking === false}
                  onClick={() => update("requireParking", false)}
                  type="button"
                  variant={
                    values.requireParking === false ? "primary" : "secondary"
                  }
                >
                  No
                </Button>
              </div>
              {errors.requireParking ? (
                <p
                  id="quotation-parking-error"
                  role="alert"
                  className="text-body text-destructive"
                >
                  {errors.requireParking}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label id="quotation-breakfast-label">¿Desea desayunos?</Label>
              <div
                className="flex gap-3"
                role="group"
                aria-labelledby="quotation-breakfast-label"
                id="quotation-breakfast"
              >
                <Button
                  id="quotation-breakfast-yes"
                  aria-pressed={values.breakfastRequested}
                  onClick={() => update("breakfastRequested", true)}
                  type="button"
                  variant={values.breakfastRequested ? "primary" : "secondary"}
                >
                  Sí
                </Button>
                <Button
                  aria-pressed={!values.breakfastRequested}
                  onClick={() => {
                    update("breakfastRequested", false);
                    update("breakfastQuantity", "");
                  }}
                  type="button"
                  variant={!values.breakfastRequested ? "primary" : "secondary"}
                >
                  No
                </Button>
              </div>
              {values.breakfastRequested && breakfast ? (
                <div className="vv-quotation-inline-panel space-y-3 rounded-md border border-border bg-muted p-4">
                  <Text className="text-foreground">
                    {breakfast.description}
                  </Text>
                  <Price amount={breakfast.unitPriceClp} suffix="/ desayuno" />
                  <FormField
                    id="quotation-breakfast-quantity"
                    label="Desayunos por noche"
                    required
                    error={errors.breakfastQuantity}
                    inputProps={{
                      min: 1,
                      onChange: (event) =>
                        update("breakfastQuantity", event.target.value),
                      type: "number",
                      value: values.breakfastQuantity,
                    }}
                  />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quotation-message" required>
                Mensaje
              </Label>
              <Text id="quotation-message-hint" className="text-foreground">
                Agrega aquí cualquier información adicional que consideres
                relevante para tu cotización.
              </Text>
              <textarea
                id="quotation-message"
                rows={5}
                value={values.message}
                onChange={(event) => update("message", event.target.value)}
                aria-describedby="quotation-message-hint"
                aria-invalid={errors.message ? true : undefined}
                required
                className="min-h-28 w-full rounded-md border bg-card px-4 py-3 text-base text-foreground focus:border-ring"
              />
              {errors.message ? (
                <p role="alert" className="text-body text-destructive">
                  {errors.message}
                </p>
              ) : null}
            </div>
            {errors.form ? (
              <Feedback
                variant="error"
                title="No pudimos preparar la cotización"
              >
                {errors.form}
              </Feedback>
            ) : null}
            <Button
              disabled={status === "submitting" || !allocation.isComplete}
              loading={status === "submitting"}
              type="submit"
            >
              Generar y enviar cotización
            </Button>
          </section>
        ) : null}
      </form>
      {status === "success" ? <CompanyQuotationConfirmationModal /> : null}
    </>
  );
}
