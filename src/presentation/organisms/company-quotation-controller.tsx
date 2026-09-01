"use client";

import { useState, type FormEvent } from "react";
import { Button, Feedback, Text } from "@/presentation/atoms";
import { DateField, FormField } from "@/presentation/molecules";
import {
  publicApiResponseError,
  safePublicErrorMessage,
} from "@/presentation/public-api-message";
import { CompanyQuotationForm } from "./company-quotation-form";

type AvailabilityRoom = Readonly<{
  availableUnits: number;
  capacity: number;
  name: string;
  nightlyPriceClp: number;
  slug: string;
}>;

type AvailabilityResult = Readonly<{
  checkIn: string;
  checkOut: string;
  coversGuestCount: boolean;
  guestCount: number;
  rooms: readonly AvailabilityRoom[];
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
        className="space-y-5 rounded-xl border bg-card p-5 shadow-sm tablet:p-7"
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
          className="grid gap-5 tablet:grid-cols-4 tablet:items-end"
        >
          <DateField
            id="quotation-search-check-in"
            label="Fecha de entrada"
            required
            value={values.checkIn}
            onChange={(event) => update("checkIn", event.target.value)}
            error={errors.checkIn}
          />
          <DateField
            id="quotation-search-check-out"
            label="Fecha de salida"
            required
            value={values.checkOut}
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
        {errors.form ? (
          <Feedback variant="error" title="No pudimos consultar disponibilidad">
            {errors.form}
          </Feedback>
        ) : null}
      </section>

      {availability ? (
        <section aria-live="polite" className="space-y-6">
          <div
            className={`rounded-lg border p-4 ${
              availability.rooms.length === 0
                ? "border-destructive bg-destructive/10"
                : "border-accent/40 bg-accent/10"
            }`}
          >
            {availability.rooms.length === 0 ? (
              <p className="text-sm text-foreground">
                No hay habitaciones disponibles para esas fechas. Ajusta las
                fechas o la cantidad de personas para volver a consultar.
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
                    solicitadas. Puedes continuar con una cotización parcial o
                    ajustar tu búsqueda.
                  </p>
                ) : null}
              </div>
            )}
          </div>
          {availability.rooms.length > 0 ? (
            <CompanyQuotationForm
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
