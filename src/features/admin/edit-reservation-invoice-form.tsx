"use client";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";
import type { EditReservationInvoiceActionResult } from "./edit-reservation-invoice-action";

const controlClass =
  "min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";

export type ReservationInvoiceValues = Readonly<{
  businessActivity: string;
  email: string;
  name: string;
  phone: string;
  rut: string;
}>;

const emptyInvoice: ReservationInvoiceValues = {
  businessActivity: "",
  email: "",
  name: "",
  phone: "",
  rut: "",
};

export function EditReservationInvoiceForm({
  action,
  invoice,
  reservationId,
}: Readonly<{
  action: (data: FormData) => Promise<EditReservationInvoiceActionResult>;
  invoice?: ReservationInvoiceValues;
  reservationId: string;
}>) {
  const router = useRouter();
  const formId = useId();
  const [requested, setRequested] = useState(Boolean(invoice));
  const [values, setValues] = useState<ReservationInvoiceValues>(
    invoice ?? emptyInvoice
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const { notify } = useToast();

  const setField = (field: keyof ReservationInvoiceValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(undefined);
    setPending(true);
    try {
      const data = new FormData();
      data.set("reservationId", reservationId);
      data.set("requested", String(requested));
      data.set("name", values.name);
      data.set("rut", values.rut);
      data.set("phone", values.phone);
      data.set("businessActivity", values.businessActivity);
      data.set("email", values.email);
      const result = await action(data);
      if (result.ok) {
        const successMessage = requested
          ? "Datos de facturación guardados."
          : "Se quitó la factura de esta reserva.";
        setMessage(successMessage);
        notify("success", successMessage);
        router.refresh();
      } else {
        setMessage(result.message);
        notify("error", result.message);
      }
    } catch {
      setMessage("No pudimos actualizar la facturación.");
      notify("error", "No pudimos actualizar la facturación.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      aria-label="Editar facturación"
      onSubmit={(event) => void submit(event)}
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold">
        <input
          checked={requested}
          className="size-4"
          onChange={(event) => setRequested(event.target.checked)}
          type="checkbox"
        />
        Solicitar factura
      </label>
      {requested ? (
        <div className="grid gap-3 tablet:grid-cols-2">
          <label
            htmlFor={`${formId}-name`}
            className="flex flex-col gap-1 text-sm font-medium text-foreground"
          >
            Razón social
            <input
              id={`${formId}-name`}
              name="name"
              value={values.name}
              onChange={(event) => setField("name", event.target.value)}
              required
              className={controlClass}
            />
          </label>
          <label
            htmlFor={`${formId}-rut`}
            className="flex flex-col gap-1 text-sm font-medium text-foreground"
          >
            RUT
            <input
              id={`${formId}-rut`}
              name="rut"
              value={values.rut}
              onChange={(event) => setField("rut", event.target.value)}
              required
              className={controlClass}
            />
          </label>
          <label
            htmlFor={`${formId}-phone`}
            className="flex flex-col gap-1 text-sm font-medium text-foreground"
          >
            Teléfono de facturación
            <input
              id={`${formId}-phone`}
              type="tel"
              name="phone"
              value={values.phone}
              onChange={(event) => setField("phone", event.target.value)}
              required
              className={controlClass}
            />
          </label>
          <label
            htmlFor={`${formId}-business-activity`}
            className="flex flex-col gap-1 text-sm font-medium text-foreground"
          >
            Giro
            <input
              id={`${formId}-business-activity`}
              name="businessActivity"
              value={values.businessActivity}
              onChange={(event) =>
                setField("businessActivity", event.target.value)
              }
              required
              className={controlClass}
            />
          </label>
          <label
            htmlFor={`${formId}-email`}
            className="flex flex-col gap-1 text-sm font-medium text-foreground tablet:col-span-2"
          >
            Correo de facturación
            <input
              id={`${formId}-email`}
              type="email"
              name="email"
              value={values.email}
              onChange={(event) => setField("email", event.target.value)}
              required
              className={controlClass}
            />
          </label>
        </div>
      ) : null}
      <Button type="submit" loading={pending}>
        {requested ? "Guardar factura" : "Quitar factura"}
      </Button>
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </form>
  );
}
