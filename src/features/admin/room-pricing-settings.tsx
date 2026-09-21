"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, Feedback, Text } from "@/presentation/atoms";
import { FormField } from "@/presentation/molecules";

type RoomPricingRecord = Readonly<{
  roomId: string;
  name: string;
  capacity: number;
  prices: readonly number[];
}>;

function guestLabel(occupancy: number) {
  return `Precio para ${occupancy} ${occupancy === 1 ? "persona" : "personas"}`;
}

export function RoomPricingSettings({
  roomId,
}: Readonly<{ roomId: string }>) {
  const [record, setRecord] = useState<RoomPricingRecord | null>(null);
  const [prices, setPrices] = useState<readonly string[]>([]);
  const [samePrice, setSamePrice] = useState(true);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<
    "loading" | "idle" | "saving" | "saved" | "error"
  >("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/habitaciones/${roomId}/tarifas`, {
      credentials: "same-origin",
    })
      .then((response) => {
        if (!response.ok) throw new Error("No pudimos cargar la tarifa.");
        return response.json() as Promise<RoomPricingRecord>;
      })
      .then((data) => {
        if (cancelled) return;
        setRecord(data);
        setPrices(data.prices.map(String));
        setSamePrice(data.prices.every((price) => price === data.prices[0]));
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const hasOccupancyChoice = (record?.capacity ?? 1) > 1;

  function setPriceAt(index: number, value: string) {
    setPrices((current) => {
      if (samePrice) return current.map(() => value);
      return current.map((price, i) => (i === index ? value : price));
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || status === "saving") return;
    const parsed = prices.map((price) => Number(price));
    if (parsed.some((price) => !Number.isSafeInteger(price) || price <= 0)) {
      setError("Indica precios válidos en CLP.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/habitaciones/${roomId}/tarifas`, {
        body: JSON.stringify({ prices: parsed }),
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!response.ok) throw new Error("No pudimos guardar la tarifa.");
      const updated = (await response.json()) as RoomPricingRecord;
      setRecord(updated);
      setPrices(updated.prices.map(String));
      setStatus("saved");
    } catch {
      setError("No pudimos guardar la tarifa.");
      setStatus("error");
    }
  }

  if (status === "loading" || !record) {
    return <Text className="text-muted-foreground">Cargando…</Text>;
  }

  return (
    <section className="max-w-xl space-y-5 rounded-xl border bg-card p-6 shadow-sm">
      <div>
        <h2 className="font-heading text-title text-foreground">
          {record.name}
        </h2>
        <Text className="mt-1 text-muted-foreground">
          {hasOccupancyChoice
            ? "Define el precio por noche según la cantidad de personas que se alojen."
            : "Esta habitación admite 1 huésped como máximo: un único precio por noche."}
        </Text>
      </div>
      <form onSubmit={submit} className="space-y-5" noValidate>
        {hasOccupancyChoice ? (
          <label className="flex items-center gap-2 text-body">
            <input
              type="checkbox"
              checked={samePrice}
              onChange={(event) => {
                const checked = event.target.checked;
                setSamePrice(checked);
                if (checked) setPrices((current) => current.map(() => current[0] ?? ""));
              }}
            />
            Cobrar el mismo precio para cualquier cantidad de personas
          </label>
        ) : null}
        {prices.map((price, index) => {
          if (samePrice && index > 0) return null;
          return (
            <FormField
              key={index}
              id={`room-pricing-${index + 1}`}
              label={
                hasOccupancyChoice ? guestLabel(index + 1) : "Precio por noche"
              }
              required
              inputProps={{
                min: 0,
                onChange: (event) => setPriceAt(index, event.target.value),
                type: "number",
                value: price,
              }}
            />
          );
        })}
        {error ? (
          <Feedback variant="error" title="No pudimos guardar">
            {error}
          </Feedback>
        ) : null}
        {status === "saved" ? (
          <Feedback variant="success" title="Guardado">
            La tarifa se actualizó correctamente.
          </Feedback>
        ) : null}
        <Button
          disabled={status === "saving"}
          loading={status === "saving"}
          type="submit"
        >
          Guardar tarifas
        </Button>
      </form>
    </section>
  );
}
