"use client";

import { useRef, useState } from "react";
import { Input, Label } from "@/presentation/atoms";
import { validateGuestForm } from "./guest-form-validation";

type Values = Record<string, string>;
const fields = ["firstName", "lastName", "email", "phone", "comment"] as const;
const invoiceFields = [
  "invoiceName",
  "invoiceRut",
  "invoicePhone",
  "invoiceBusinessActivity",
  "invoiceEmail",
] as const;

/**
 * No "Continuar" step: every field validates and syncs into the URL as
 * soon as the guest leaves it (blur), so `BookingConfirmationController`
 * always reads current guest data from `window.location.search` without
 * a separate confirmation click for this form.
 */
export function GuestInformationForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [invoiceRequested, setInvoiceRequested] = useState(false);

  const computeErrors = (data: Values, invoiceRequestedNow: boolean) => {
    const result = validateGuestForm({ ...data, guestCount: 1 });
    const next: Record<string, string> = {};
    if (!result.ok) {
      for (const issue of result.issues) next[issue.field] = issue.message;
    }
    if (invoiceRequestedNow && !isValidChileanRut(data.invoiceRut ?? "")) {
      next.invoiceRut = "Ingresa un RUT chileno válido.";
    }
    return next;
  };

  const syncToUrl = (data: Values, invoiceRequestedNow: boolean) => {
    const params = new URLSearchParams(window.location.search);
    for (const field of fields) {
      const value = data[field];
      if (value) params.set(field, value);
      else params.delete(field);
    }
    if (invoiceRequestedNow) {
      params.set("invoiceRequested", "true");
      for (const field of invoiceFields) {
        const value = data[field];
        if (value) params.set(field, value);
        else params.delete(field);
      }
    } else {
      params.delete("invoiceRequested");
      for (const field of invoiceFields) params.delete(field);
    }
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  };

  /** Validates and syncs a single field as soon as the guest leaves it. */
  const handleFieldBlur = (field: string, invoiceRequestedNow = invoiceRequested) => {
    if (!formRef.current) return;
    const data = Object.fromEntries(new FormData(formRef.current)) as Values;
    const allErrors = computeErrors(data, invoiceRequestedNow);
    setErrors((previous) => {
      const next = { ...previous };
      if (allErrors[field]) next[field] = allErrors[field];
      else delete next[field];
      return next;
    });
    syncToUrl(data, invoiceRequestedNow);
  };

  const handleInvoiceToggle = (checked: boolean) => {
    setInvoiceRequested(checked);
    if (!formRef.current) return;
    const data = Object.fromEntries(new FormData(formRef.current)) as Values;
    setErrors((previous) => {
      if (checked) return previous;
      const next = { ...previous };
      delete next.invoiceRut;
      return next;
    });
    syncToUrl(data, checked);
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => event.preventDefault()}
      aria-label="Datos del huésped"
      className="space-y-4 rounded-2xl bg-card p-5 shadow-md tablet:p-6"
    >
      <h2 className="font-heading text-title text-foreground">
        Datos del huésped
      </h2>
      <span aria-hidden="true" className="block h-1 w-14 bg-accent" />
      {Object.keys(errors).length ? (
        <div
          role="alert"
          tabIndex={-1}
          className="rounded-md bg-muted p-3 text-sm"
        >
          <p className="font-semibold">Corrige la información indicada:</p>
          <ul>
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="grid gap-4 tablet:grid-cols-2">
        {fields.map((field) => {
          const optional = ["comment"].includes(field);
          const label = (
            {
              firstName: "Nombre",
              lastName: "Apellido",
              email: "Correo electrónico",
              phone: "Teléfono",
              comment: "Comentario",
            } as const
          )[field];
          return (
            <div
              key={field}
              className={field === "comment" ? "tablet:col-span-2" : ""}
            >
              <Label htmlFor={`guest-${field}`} required={!optional}>
                {label}
              </Label>
              <Input
                id={`guest-${field}`}
                name={field}
                type={field === "email" ? "email" : "text"}
                onBlur={() => handleFieldBlur(field)}
                aria-invalid={Boolean(errors[field])}
                aria-describedby={
                  errors[field] ? `guest-${field}-error` : undefined
                }
              />
              {errors[field] ? (
                <p
                  id={`guest-${field}-error`}
                  className="mt-1 text-sm text-destructive"
                >
                  {errors[field]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="invoiceRequested"
          checked={invoiceRequested}
          onChange={(event) => handleInvoiceToggle(event.target.checked)}
        />{" "}
        Solicitar factura
      </label>
      {invoiceRequested ? (
        <fieldset className="grid gap-4 rounded-md border border-border p-4 tablet:grid-cols-2">
          <legend>Datos para factura</legend>
          {(
            [
              ["invoiceName", "Nombre o razón social"],
              ["invoiceRut", "RUT"],
              ["invoicePhone", "Teléfono de contacto"],
              ["invoiceBusinessActivity", "Giro"],
              ["invoiceEmail", "Correo de facturación"],
            ] as const
          ).map(([name, label]) => (
            <div key={name}>
              <Label htmlFor={name} required>
                {label}
              </Label>
              <Input
                id={name}
                name={name}
                type={name === "invoiceEmail" ? "email" : "text"}
                required
                onBlur={() => handleFieldBlur(name, true)}
                aria-invalid={Boolean(errors[name])}
              />
              {errors[name] ? (
                <p className="text-sm text-destructive">{errors[name]}</p>
              ) : null}
            </div>
          ))}
        </fieldset>
      ) : null}
    </form>
  );
}

function isValidChileanRut(value: string) {
  const compact = value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(compact)) return false;
  let sum = 0;
  let factor = 2;
  for (const digit of [...compact.slice(0, -1)].reverse()) {
    sum += Number(digit) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  return (
    compact.at(-1) ===
    String(11 - (sum % 11))
      .replace("10", "K")
      .replace("11", "0")
  );
}
