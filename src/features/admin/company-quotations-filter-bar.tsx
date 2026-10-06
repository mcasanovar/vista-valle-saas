"use client";

import Link from "next/link";

import { Button, Input } from "@/presentation/atoms";
import { DateRangeField } from "./date-range-field";

export type CompanyQuotationsFilterBarValues = Readonly<{
  search?: string;
  checkInFrom?: string;
  checkInTo?: string;
  checkOutFrom?: string;
  checkOutTo?: string;
  deliveryState?: string;
}>;

const deliveryStateOptions = [
  { value: "", label: "Todos" },
  { value: "delivered", label: "Entregado" },
  { value: "pending", label: "Pendiente" },
  { value: "failed", label: "Falló" },
] as const;

/** One GET form, like the reservations filter bar: filters live in the URL so results stay shareable. */
export function CompanyQuotationsFilterBar({
  values,
}: Readonly<{ values: CompanyQuotationsFilterBarValues }>) {
  return (
    <form
      aria-label="Buscar y filtrar cotizaciones"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <Input
        type="search"
        name="search"
        defaultValue={values.search}
        placeholder="Buscar por empresa, contacto, email o teléfono…"
        aria-label="Buscar cotizaciones"
      />
      <div className="flex flex-wrap items-center gap-3">
        <DateRangeField
          name="checkIn"
          label="Llegada"
          defaultFrom={values.checkInFrom}
          defaultTo={values.checkInTo}
        />
        <DateRangeField
          name="checkOut"
          label="Salida"
          defaultFrom={values.checkOutFrom}
          defaultTo={values.checkOutTo}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Entrega del correo
          <select
            name="deliveryState"
            defaultValue={values.deliveryState ?? ""}
            className="min-h-11 rounded-md border border-border bg-card px-3"
          >
            {deliveryStateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Buscar</Button>
        <Link
          href="/admin/cotizaciones"
          className="text-sm font-semibold text-muted-foreground hover:underline"
        >
          Limpiar filtros
        </Link>
      </div>
    </form>
  );
}
