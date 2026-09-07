"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Feedback, Heading, Text } from "@/presentation/atoms";
import { FormField } from "@/presentation/molecules";

type BreakfastCatalog = Readonly<{
  description: string;
  unitPriceClp: number;
}>;

export function BreakfastCatalogSettings() {
  const [values, setValues] = useState<{
    description: string;
    unitPriceClp: string;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<
    "loading" | "idle" | "saving" | "saved" | "error"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/breakfast-catalog", { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error("No pudimos cargar el desayuno.");
        return response.json() as Promise<BreakfastCatalog>;
      })
      .then((data) => {
        if (cancelled) return;
        setValues({
          description: data.description,
          unitPriceClp: String(data.unitPriceClp),
        });
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values || status === "saving") return;
    const nextErrors: Record<string, string> = {};
    if (!values.description.trim())
      nextErrors.description = "Este campo es obligatorio.";
    const unitPriceClp = Number(values.unitPriceClp);
    if (!Number.isSafeInteger(unitPriceClp) || unitPriceClp < 0)
      nextErrors.unitPriceClp = "Indique un precio válido en CLP.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrors({});
    try {
      const response = await fetch("/api/admin/breakfast-catalog", {
        body: JSON.stringify({
          description: values.description.trim(),
          unitPriceClp,
        }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) throw new Error("No pudimos guardar el desayuno.");
      setStatus("saved");
    } catch {
      setErrors({ form: "No pudimos guardar el desayuno." });
      setStatus("error");
    }
  }

  if (status === "loading" || !values) {
    return <Text className="text-muted-foreground">Cargando…</Text>;
  }

  return (
    <section className="max-w-xl space-y-5 rounded-xl border bg-card p-6 shadow-sm">
      <div>
        <Heading level={2}>Desayuno para cotizaciones de empresa</Heading>
        <Text className="mt-1 text-muted-foreground">
          Este contenido y precio se muestran a los visitantes que soliciten
          desayuno en su cotización.
        </Text>
      </div>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <label
            htmlFor="breakfast-catalog-description"
            className="text-body font-semibold text-foreground"
          >
            Qué incluye el desayuno
          </label>
          <textarea
            id="breakfast-catalog-description"
            rows={4}
            value={values.description}
            onChange={(event) =>
              setValues({ ...values, description: event.target.value })
            }
            className="min-h-28 w-full rounded-md border bg-card px-4 py-3 text-base text-foreground focus:border-ring"
          />
          {errors.description ? (
            <p role="alert" className="text-body text-destructive">
              {errors.description}
            </p>
          ) : null}
        </div>
        <FormField
          id="breakfast-catalog-price"
          label="Precio por desayuno (CLP)"
          required
          error={errors.unitPriceClp}
          inputProps={{
            min: 0,
            onChange: (event) =>
              setValues({ ...values, unitPriceClp: event.target.value }),
            type: "number",
            value: values.unitPriceClp,
          }}
        />
        {errors.form ? (
          <Feedback variant="error" title="No pudimos guardar">
            {errors.form}
          </Feedback>
        ) : null}
        {status === "saved" ? (
          <Feedback variant="success" title="Guardado">
            El desayuno se actualizó correctamente.
          </Feedback>
        ) : null}
        <Button
          disabled={status === "saving"}
          loading={status === "saving"}
          type="submit"
        >
          Guardar
        </Button>
      </form>
    </section>
  );
}
