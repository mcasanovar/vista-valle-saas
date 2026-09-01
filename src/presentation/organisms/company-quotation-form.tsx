"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button, Feedback, Heading, Label, Text } from "@/presentation/atoms";
import { FormField, Price } from "@/presentation/molecules";
import {
  publicApiResponseError,
  safePublicErrorMessage,
} from "@/presentation/public-api-message";
import { CompanyQuotationConfirmationModal } from "./company-quotation-confirmation-modal";

type AvailableRoomOption = Readonly<{
  availableUnits: number;
  capacity: number;
  name: string;
  nightlyPriceClp: number;
  slug: string;
}>;

type FormValues = Readonly<{
  company: string;
  contact: string;
  email: string;
  message: string;
  phone: string;
  requirements: string;
}>;

const initialValues: FormValues = {
  company: "",
  contact: "",
  email: "",
  message: "",
  phone: "",
  requirements: "",
};

function formatCapacity(value: number) {
  return `${value} ${value === 1 ? "persona" : "personas"}`;
}

function formatUnits(value: number) {
  return `${value} ${value === 1 ? "disponible" : "disponibles"}`;
}

export function CompanyQuotationForm({
  checkIn,
  checkOut,
  guestCount,
  rooms,
}: Readonly<{
  checkIn: string;
  checkOut: string;
  guestCount: number;
  rooms: readonly AvailableRoomOption[];
}>) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  const selectedRooms = useMemo(
    () => rooms.filter((room) => (quantities[room.slug] ?? 0) > 0),
    [quantities, rooms]
  );
  const capacity = selectedRooms.reduce(
    (total, room) => total + room.capacity * (quantities[room.slug] ?? 0),
    0
  );
  const capacityShortfall = guestCount > capacity ? guestCount - capacity : 0;

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setStatus("idle");
  }

  function toggleRoom(slug: string) {
    setQuantities((current) => ({
      ...current,
      [slug]: (current[slug] ?? 0) > 0 ? 0 : 1,
    }));
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
    if (!selectedRooms.length)
      nextErrors.rooms = "Seleccione al menos una habitación.";
    if (!values.requirements)
      nextErrors.requirements = "Este campo es obligatorio.";
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
          checkIn,
          checkOut,
          guestCount,
          rooms: selectedRooms.map((room) => ({
            quantity: quantities[room.slug],
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
          className="space-y-5 rounded-xl border bg-card p-5 shadow-sm tablet:p-7"
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
                const selected = (quantities[room.slug] ?? 0) > 0;
                return (
                  <div
                    key={room.slug}
                    className="space-y-3 rounded-lg border border-border p-4"
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
                      <Price amount={room.nightlyPriceClp} suffix="/ noche" />
                    </div>
                    <Button
                      aria-pressed={selected}
                      onClick={() => toggleRoom(room.slug)}
                      type="button"
                      variant={selected ? "primary" : "secondary"}
                      className="w-full"
                    >
                      {selected ? "Seleccionado" : "Seleccionar"}
                    </Button>
                  </div>
                );
              })}
            </div>
            <div
              aria-live="polite"
              className={`rounded-md border p-4 ${capacityShortfall ? "border-destructive bg-destructive/10" : "border-border bg-muted"}`}
            >
              <p className="font-semibold">
                Capacidad seleccionada: {formatCapacity(capacity)}
              </p>
              <p className="text-sm">
                Personas a alojar: {formatCapacity(guestCount)}
              </p>
              {capacityShortfall ? (
                <p
                  id="quotation-rooms-error"
                  role="alert"
                  className="mt-1 text-sm text-destructive"
                >
                  Faltan {formatCapacity(capacityShortfall)} de capacidad.
                  Puedes enviar igualmente una cotización parcial.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  La capacidad se validará nuevamente al enviar.
                </p>
              )}
            </div>
            {errors.rooms ? (
              <p role="alert" className="text-body text-destructive">
                {errors.rooms}
              </p>
            ) : null}
          </div>
        </section>

        <section
          aria-labelledby="quotation-contact-heading"
          className="space-y-5 rounded-xl border bg-card p-5 shadow-sm tablet:p-7"
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
          <FormField
            id="quotation-requirements"
            label="Requisitos"
            required
            error={errors.requirements}
            inputProps={{
              onChange: (event) => update("requirements", event.target.value),
              value: values.requirements,
            }}
          />
          <div className="space-y-2">
            <Label htmlFor="quotation-message" required>
              Mensaje
            </Label>
            <textarea
              id="quotation-message"
              rows={5}
              value={values.message}
              onChange={(event) => update("message", event.target.value)}
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
            <Feedback variant="error" title="No pudimos preparar la cotización">
              {errors.form}
            </Feedback>
          ) : null}
          <Button
            disabled={status === "submitting"}
            loading={status === "submitting"}
            type="submit"
          >
            Generar y enviar cotización
          </Button>
        </section>
      </form>
      {status === "success" ? <CompanyQuotationConfirmationModal /> : null}
    </>
  );
}
