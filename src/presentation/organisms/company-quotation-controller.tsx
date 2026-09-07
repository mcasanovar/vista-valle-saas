"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button, Feedback, Text } from "@/presentation/atoms";
import { DateField, FormField } from "@/presentation/molecules";
import {
  publicApiResponseError,
  safePublicErrorMessage,
} from "@/presentation/public-api-message";
import { CompanyQuotationForm } from "./company-quotation-form";

// Vista Valle's stay dates are always calendar days in this time zone,
// regardless of the visitor's own device time zone (kept in sync with the
// equivalent, feature-owned logic in `@/features/availability/date-only`,
// which this shared-presentation component may not import).
const LODGING_TIME_ZONE = "America/Santiago";

function todayInLodgingTimeZone(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: LODGING_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Mirrors `@/features/availability/date-only`'s day-count logic locally:
// shared presentation may not import feature code (see
// architecture/presentation-boundaries in eslint.config.mjs).
function nightsBetween(checkIn: string, checkOut: string): number | null {
  const [checkInYear, checkInMonth, checkInDay] = checkIn
    .split("-")
    .map(Number);
  const [checkOutYear, checkOutMonth, checkOutDay] = checkOut
    .split("-")
    .map(Number);
  if (
    !checkInYear ||
    !checkInMonth ||
    !checkInDay ||
    !checkOutYear ||
    !checkOutMonth ||
    !checkOutDay
  ) {
    return null;
  }
  const checkInEpochDay = Date.UTC(checkInYear, checkInMonth - 1, checkInDay);
  const checkOutEpochDay = Date.UTC(
    checkOutYear,
    checkOutMonth - 1,
    checkOutDay
  );
  const nights = Math.round(
    (checkOutEpochDay - checkInEpochDay) / (24 * 60 * 60 * 1000)
  );
  return nights > 0 ? nights : null;
}

function formatNights(value: number) {
  return `${value} ${value === 1 ? "noche" : "noches"}`;
}

function addCalendarDays(date: string, amount: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + amount));
  return next.toISOString().slice(0, 10);
}

type AvailabilityRoom = Readonly<{
  availableUnits: number;
  capacity: number;
  name: string;
  nightlyPriceClp: number;
  slug: string;
}>;

type AvailabilityRoomType = Readonly<{
  availableUnits: number;
  capacity: number;
  name: string;
  nightlyPriceClp: number;
  slug: string;
  totalUnits: number;
}>;

type AvailabilityBreakfastCatalog = Readonly<{
  description: string;
  unitPriceClp: number;
}>;

type AvailabilityResult = Readonly<{
  breakfast: AvailabilityBreakfastCatalog | null;
  checkIn: string;
  checkOut: string;
  coversGuestCount: boolean;
  guestCount: number;
  rooms: readonly AvailabilityRoom[];
  roomTypes: readonly AvailabilityRoomType[];
  totalActiveRooms: number;
  totalAvailableCapacity: number;
  totalAvailableRooms: number;
}>;

type SearchValues = Readonly<{
  checkIn: string;
  checkOut: string;
  guestCount: string;
}>;

const initialSearch: SearchValues = {
  checkIn: "",
  checkOut: "",
  guestCount: "",
};

function formatCapacity(value: number) {
  return `${value} ${value === 1 ? "persona" : "personas"}`;
}

function formatRoomCount(value: number) {
  return `${value} ${value === 1 ? "habitación" : "habitaciones"}`;
}

function formatAvailableRoomCount(value: number) {
  return `${value} ${value === 1 ? "habitación disponible" : "habitaciones disponibles"}`;
}

export function CompanyQuotationController() {
  const [values, setValues] = useState<SearchValues>(initialSearch);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [availability, setAvailability] = useState<AvailabilityResult | null>(
    null
  );

  const dateMinimums = useMemo(() => {
    const checkIn = todayInLodgingTimeZone();
    return { checkIn, checkOut: addCalendarDays(checkIn, 1) };
  }, []);
  const checkOutMin =
    values.checkIn && values.checkIn > dateMinimums.checkIn
      ? addCalendarDays(values.checkIn, 1)
      : dateMinimums.checkOut;
  const selectedNights =
    values.checkIn && values.checkOut
      ? nightsBetween(values.checkIn, values.checkOut)
      : null;

  function update(field: keyof SearchValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;
    const nextErrors: Record<string, string> = {};
    if (!values.checkIn) nextErrors.checkIn = "Este campo es obligatorio.";
    if (!values.checkOut) nextErrors.checkOut = "Este campo es obligatorio.";
    if (
      values.checkIn &&
      values.checkOut &&
      values.checkOut <= values.checkIn
    ) {
      nextErrors.checkOut = "La salida debe ser posterior a la entrada.";
    }
    const guestCount = Number(values.guestCount);
    if (!Number.isSafeInteger(guestCount) || guestCount < 1) {
      nextErrors.guestCount = "Indique una cantidad válida.";
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setAvailability(null);
      return;
    }

    setStatus("loading");
    setErrors({});
    setAvailability(null);
    try {
      const search = new URLSearchParams({
        checkIn: values.checkIn,
        checkOut: values.checkOut,
        guestCount: String(guestCount),
      });
      const response = await fetch(
        `/api/company-quotations/availability?${search.toString()}`
      );
      const body = (await response.json()) as AvailabilityResult & {
        message?: string;
      };
      if (!response.ok) {
        throw publicApiResponseError(
          body,
          "No pudimos consultar disponibilidad."
        );
      }
      setAvailability(body);
      setStatus("idle");
    } catch (error) {
      setErrors({
        form: safePublicErrorMessage(
          error,
          "No pudimos consultar disponibilidad."
        ),
      });
      setStatus("error");
    }
  }

  const showsFullAvailability =
    availability !== null &&
    availability.totalAvailableRooms === availability.totalActiveRooms &&
    availability.totalActiveRooms > 0;

  return (
    <div className="space-y-8">
      <section
        aria-labelledby="quotation-search-heading"
        className="vv-quotation-panel space-y-5"
      >
        <div>
          <h2
            id="quotation-search-heading"
            className="font-heading text-title font-normal text-foreground"
          >
            Fechas y personas
          </h2>
          <Text className="mt-2 text-muted-foreground">
            Indica tus fechas y la cantidad de personas para revisar la
            disponibilidad antes de cotizar.
          </Text>
        </div>
        <form
          aria-label="Consulta de disponibilidad para cotización"
          noValidate
          onSubmit={submit}
          className="vv-quotation-search-form grid gap-5 tablet:grid-cols-4 tablet:items-end"
        >
          <DateField
            id="quotation-search-check-in"
            label="Fecha de entrada"
            required
            value={values.checkIn}
            min={dateMinimums.checkIn}
            onChange={(event) => update("checkIn", event.target.value)}
            error={errors.checkIn}
          />
          <DateField
            id="quotation-search-check-out"
            label="Fecha de salida"
            required
            value={values.checkOut}
            min={checkOutMin}
            onChange={(event) => update("checkOut", event.target.value)}
            error={errors.checkOut}
          />
          <FormField
            id="quotation-search-guests"
            label="Personas a alojar"
            required
            error={errors.guestCount}
            inputProps={{
              min: 1,
              name: "guestCount",
              onChange: (event) => update("guestCount", event.target.value),
              type: "number",
              value: values.guestCount,
            }}
          />
          <Button
            disabled={status === "loading"}
            loading={status === "loading"}
            type="submit"
          >
            Consultar disponibilidad
          </Button>
        </form>
        {selectedNights ? (
          <Text aria-live="polite" className="text-foreground">
            Estás seleccionando {formatNights(selectedNights)}.
          </Text>
        ) : null}
        {errors.form ? (
          <Feedback variant="error" title="No pudimos consultar disponibilidad">
            {errors.form}
          </Feedback>
        ) : null}
      </section>

      {availability ? (
        <section aria-live="polite" className="space-y-6">
          <div
            className={`vv-quotation-status rounded-lg border p-4 ${
              availability.rooms.length === 0
                ? "border-destructive bg-destructive/10"
                : "border-accent/40 bg-accent/10"
            }`}
          >
            {availability.rooms.length === 0 ? (
              <p className="text-sm text-foreground">
                No hay habitaciones disponibles para esas fechas. Revisa el
                detalle abajo para ver qué habitaciones están ocupadas, o ajusta
                las fechas y vuelve a consultar.
              </p>
            ) : (
              <div className="space-y-1 text-sm text-foreground">
                <p>
                  {showsFullAvailability
                    ? `Todas las habitaciones están disponibles para tus fechas: ${formatRoomCount(availability.totalAvailableRooms)}, con capacidad para ${formatCapacity(availability.totalAvailableCapacity)}.`
                    : `Hay ${formatAvailableRoomCount(availability.totalAvailableRooms)} para tus fechas, con capacidad para ${formatCapacity(availability.totalAvailableCapacity)}.`}
                </p>
                {!availability.coversGuestCount ? (
                  <p className="font-semibold text-destructive">
                    Faltan{" "}
                    {formatCapacity(
                      availability.guestCount -
                        availability.totalAvailableCapacity
                    )}{" "}
                    para alojar a las {formatCapacity(availability.guestCount)}{" "}
                    solicitadas. Con lo disponible alcanzamos para{" "}
                    {formatCapacity(availability.totalAvailableCapacity)}.
                    Puedes continuar con una cotización parcial o ajustar tu
                    búsqueda.
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Text className="font-semibold text-foreground">
              Detalle por tipo de habitación
            </Text>
            <ul className="grid gap-2 tablet:grid-cols-3">
              {availability.roomTypes.map((type) => {
                const isAvailable = type.availableUnits > 0;
                return (
                  <li
                    key={type.slug}
                    className={`vv-quotation-room-type space-y-1 rounded-md border p-3 text-sm ${
                      isAvailable
                        ? "border-border bg-card"
                        : "border-destructive/40 bg-destructive/5"
                    }`}
                  >
                    <p className="font-semibold text-foreground">{type.name}</p>
                    <p className="text-muted-foreground">
                      Capacidad por habitación: {formatCapacity(type.capacity)}
                    </p>
                    <p
                      className={
                        isAvailable
                          ? "font-semibold text-foreground"
                          : "font-semibold text-destructive"
                      }
                    >
                      {isAvailable
                        ? `${type.availableUnits} de ${type.totalUnits} disponible${type.totalUnits === 1 ? "" : "s"}`
                        : "No disponible en estas fechas"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
          {availability.rooms.length > 0 ? (
            <CompanyQuotationForm
              breakfast={availability.breakfast}
              checkIn={availability.checkIn}
              checkOut={availability.checkOut}
              guestCount={availability.guestCount}
              rooms={availability.rooms}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
