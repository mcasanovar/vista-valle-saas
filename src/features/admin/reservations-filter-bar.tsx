"use client";

import { useState } from "react";
import Link from "next/link";

import { Button, Input } from "@/presentation/atoms";
import { DateRangeField } from "./date-range-field";

export type ReservationsFilterBarValues = Readonly<{
  search?: string;
  checkInFrom?: string;
  checkInTo?: string;
  checkOutFrom?: string;
  checkOutTo?: string;
  status?: string;
  origin?: string;
}>;

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "confirmed", label: "Confirmada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "completed", label: "Completada" },
  { value: "no_show", label: "No se presentó" },
] as const;

const originOptions = [
  { value: "", label: "Todos" },
  { value: "website", label: "Sitio web" },
  { value: "airbnb", label: "Airbnb" },
  { value: "booking", label: "Booking" },
  { value: "phone", label: "Teléfono" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "admin", label: "Administración" },
] as const;

/**
 * A single GET form: the button and Enter both submit it natively, no
 * debounce or client-side fetch (see design.md decision — search triggers
 * on submit only). Filters live in the URL, so results are shareable and
 * bookmarkable.
 */
export function ReservationsFilterBar({
  values,
}: Readonly<{ values: ReservationsFilterBarValues }>) {
  const [showCheckOut, setShowCheckOut] = useState(
    Boolean(values.checkOutFrom)
  );

  return (
    <form
      aria-label="Buscar y filtrar reservas"
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <Input
        type="search"
        name="search"
        defaultValue={values.search}
        placeholder="Buscar por huésped, email, teléfono, RUT, habitación…"
        aria-label="Buscar reservas"
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <DateRangeField
            name="checkIn"
            label="Llegada"
            defaultFrom={values.checkInFrom}
            defaultTo={values.checkInTo}
          />
          {!showCheckOut ? (
            <button
              type="button"
              className="text-sm font-semibold text-accent"
              onClick={() => setShowCheckOut(true)}
            >
              + Agregar filtro de salida
            </button>
          ) : null}
        </div>
        {showCheckOut ? (
          <div className="flex flex-wrap items-center gap-3">
            <DateRangeField
              name="checkOut"
              label="Salida"
              defaultFrom={values.checkOutFrom}
              defaultTo={values.checkOutTo}
            />
            <button
              type="button"
              className="text-sm font-semibold text-muted-foreground"
              onClick={() => setShowCheckOut(false)}
            >
              Quitar filtro de salida
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          Estado
          <select
            name="status"
            defaultValue={values.status ?? ""}
            className="min-h-11 rounded-md border border-border bg-card px-3"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          Origen
          <select
            name="origin"
            defaultValue={values.origin ?? ""}
            className="min-h-11 rounded-md border border-border bg-card px-3"
          >
            {originOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Buscar</Button>
        <Link
          href="/admin/reservas"
          className="text-sm font-semibold text-muted-foreground hover:underline"
        >
          Limpiar filtros
        </Link>
      </div>
    </form>
  );
}
