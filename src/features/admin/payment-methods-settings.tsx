"use client";

import { useEffect, useState } from "react";
import { Feedback, Heading, Text } from "@/presentation/atoms";

type PaymentMethodSettings = Readonly<{
  payAtPropertyEnabled: boolean;
  payOnlineEnabled: boolean;
}>;

export function PaymentMethodsSettings() {
  const [values, setValues] = useState<PaymentMethodSettings | null>(null);
  const [status, setStatus] = useState<
    "loading" | "idle" | "saving" | "saved" | "error"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/payment-methods", { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok)
          throw new Error("No pudimos cargar los métodos de pago.");
        return response.json() as Promise<PaymentMethodSettings>;
      })
      .then((data) => {
        if (cancelled) return;
        setValues(data);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(next: PaymentMethodSettings) {
    if (status === "saving") return;
    setValues(next);
    setStatus("saving");
    try {
      const response = await fetch("/api/admin/payment-methods", {
        body: JSON.stringify(next),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!response.ok)
        throw new Error("No pudimos guardar los métodos de pago.");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  if (status === "loading" || !values) {
    return <Text className="text-muted-foreground">Cargando…</Text>;
  }

  return (
    <section className="max-w-xl space-y-5 rounded-xl border bg-card p-6 shadow-sm">
      <div>
        <Heading level={2}>Métodos de pago</Heading>
        <Text className="mt-1 text-muted-foreground">
          Oculta un método si hay un problema con el proveedor. Los
          huéspedes solo verán los métodos habilitados al confirmar una
          reserva.
        </Text>
      </div>
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
          <span>
            <span className="block font-semibold">Pagar al llegar</span>
            <span className="block text-sm text-muted-foreground">
              El huésped reserva y paga al llegar a Vista Valle.
            </span>
          </span>
          <input
            type="checkbox"
            checked={values.payAtPropertyEnabled}
            onChange={(event) =>
              save({ ...values, payAtPropertyEnabled: event.target.checked })
            }
            className="size-5 shrink-0"
            style={{ accentColor: "var(--color-accent)" }}
            aria-label="Habilitar pagar al llegar"
          />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
          <span>
            <span className="block font-semibold">Pagar online</span>
            <span className="block text-sm text-muted-foreground">
              El huésped paga de inmediato con Fintoc.
            </span>
          </span>
          <input
            type="checkbox"
            checked={values.payOnlineEnabled}
            onChange={(event) =>
              save({ ...values, payOnlineEnabled: event.target.checked })
            }
            className="size-5 shrink-0"
            style={{ accentColor: "var(--color-accent)" }}
            aria-label="Habilitar pagar online"
          />
        </label>
      </div>
      {status === "error" ? (
        <Feedback variant="error" title="No pudimos guardar">
          Inténtalo nuevamente.
        </Feedback>
      ) : null}
      {status === "saved" ? (
        <Feedback variant="success" title="Guardado">
          Los métodos de pago se actualizaron correctamente.
        </Feedback>
      ) : null}
    </section>
  );
}
