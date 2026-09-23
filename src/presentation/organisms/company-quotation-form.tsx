"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button, Feedback, Heading, Icon, Label, Text } from "@/presentation/atoms";
import { FormField, GuestAllocationMeter, Price } from "@/presentation/molecules";
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
  remainingGuestsExcludingRoom,
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

export type CompanyQuotationFormStep = "rooms" | "company";

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
  onAdvanceStep,
  rooms,
  step,
}: Readonly<{
  breakfast: BreakfastCatalog | null;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  onAdvanceStep: () => void;
  rooms: readonly AvailableRoomOption[];
  step: CompanyQuotationFormStep;
}>) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [addedRooms, setAddedRooms] = useState<Record<string, number>>({});
  const [pendingRoomSlug, setPendingRoomSlug] = useState<string | null>(null);
  const [pendingGuestCount, setPendingGuestCount] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  const selectedRooms = useMemo(
    () => rooms.filter((room) => (addedRooms[room.slug] ?? 0) > 0),
    [addedRooms, rooms]
  );
  const selections: readonly RoomOccupancySelection[] = useMemo(
    () =>
      selectedRooms.map((room) => ({
        guestCount: addedRooms[room.slug] ?? 0,
        roomId: room.slug,
      })),
    [addedRooms, selectedRooms]
  );
  const allocation = computeGuestAllocation(guestCount, selections);

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setStatus("idle");
  }

  function beginConfiguringRoom(room: AvailableRoomOption) {
    const remaining = remainingGuestsExcludingRoom(
      guestCount,
      selections,
      room.slug
    );
    setPendingRoomSlug(room.slug);
    setPendingGuestCount(Math.min(room.capacity, Math.max(remaining, 1)));
  }

  function cancelPendingRoom() {
    setPendingRoomSlug(null);
  }

  function confirmPendingRoom() {
    if (!pendingRoomSlug) return;
    setAddedRooms((current) => ({
      ...current,
      [pendingRoomSlug]: pendingGuestCount,
    }));
    setPendingRoomSlug(null);
  }

  function removeRoom(slug: string) {
    setAddedRooms((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    const nextErrors: Record<string, string> = {};
    if (!values.company) nextErrors.company = "Este campo es obligatorio.";
    if (!values.contact) nextErrors.contact = "Este campo es obligatorio.";
    if (!/^\S+@\S+\.\S+$/.test(values.email))
      nextErrors.email = "Ingrese un correo válido.";
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
            guestCount: addedRooms[room.slug],
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
        {step === "rooms" ? (
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
            <div className="space-y-3">
              <Heading level={3}>Habitaciones</Heading>
              <div className="grid gap-3 tablet:grid-cols-3">
                {rooms.map((room) => {
                  const addedCount = addedRooms[room.slug];
                  const isAdded = addedCount !== undefined;
                  const isPending = pendingRoomSlug === room.slug;
                  const activeCount = isAdded
                    ? addedCount
                    : isPending
                      ? pendingGuestCount
                      : undefined;
                  const canChoose =
                    !isAdded &&
                    pendingRoomSlug === null &&
                    allocation.remainingGuests > 0;
                  const displayedPrice =
                    activeCount !== undefined
                      ? resolveDisplayRoomNightlyPrice(
                          room,
                          room.occupancyPrices,
                          activeCount
                        )
                      : room.occupancyPrices.length
                        ? Math.min(
                            room.nightlyPriceClp,
                            ...room.occupancyPrices.map(
                              (entry) => entry.priceClp
                            )
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
                      {isPending ? (
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
                                const active = pendingGuestCount === value;
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
                                    onClick={() => setPendingGuestCount(value)}
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
                          <div className="flex gap-2">
                            <Button
                              onClick={confirmPendingRoom}
                              className="flex-1"
                            >
                              <Icon decorative name="Plus" className="size-4" />
                              Agregar habitación
                            </Button>
                            <Button
                              onClick={cancelPendingRoom}
                              variant="secondary"
                              className="flex-1"
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : isAdded ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2">
                            <Icon
                              decorative
                              name="Check"
                              className="size-4 text-primary"
                            />
                            <Text className="text-foreground">
                              {formatCapacity(addedCount)} asignadas
                            </Text>
                          </div>
                          <Button
                            onClick={() => removeRoom(room.slug)}
                            variant="secondary"
                            className="w-full"
                          >
                            Quitar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          disabled={!canChoose}
                          onClick={() => beginConfiguringRoom(room)}
                          variant="secondary"
                          className="w-full"
                        >
                          Elegir habitación
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <GuestAllocationMeter
                assigned={allocation.assignedGuests}
                total={allocation.targetGuests}
                label={describeGuestAllocation(allocation)}
              />
            </div>
            <Button disabled={!allocation.isComplete} onClick={onAdvanceStep}>
              Continuar
            </Button>
          </section>
        ) : (
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
                  variant={
                    values.requireParking === true ? "primary" : "secondary"
                  }
                >
                  Sí
                </Button>
                <Button
                  aria-pressed={values.requireParking === false}
                  onClick={() => update("requireParking", false)}
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
                    hint="Esta cantidad se multiplica por la cantidad de noches de tu estadía para calcular el total de desayunos."
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
        )}
      </form>
      {status === "success" ? <CompanyQuotationConfirmationModal /> : null}
    </>
  );
}
